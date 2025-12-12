/**
 * Batch Processor Utility
 * Optimizes bulk operations by processing in batches with controlled concurrency
 */

/**
 * Process items in batches with controlled parallelism
 * @param {Array} items - Items to process
 * @param {Function} processor - Async function to process each item
 * @param {Object} options - Configuration options
 * @param {number} options.batchSize - Number of items per batch (default: 100)
 * @param {number} options.maxConcurrency - Max parallel operations (default: 10)
 * @param {Function} options.onProgress - Callback for progress updates
 * @returns {Promise<Object>} Results with success/failure counts
 */
async function processInBatches(items, processor, options = {}) {
  const {
    batchSize = 100,
    maxConcurrency = 10,
    onProgress = null
  } = options;

  const results = {
    success: [],
    failed: [],
    total: items.length,
    processed: 0
  };

  // Process in batches
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    
    // Process batch with controlled concurrency
    const batchPromises = [];
    let batchIndex = 0;

    while (batchIndex < batch.length) {
      const concurrentBatch = batch.slice(batchIndex, batchIndex + maxConcurrency);
      
      const concurrentPromises = concurrentBatch.map(async (item, index) => {
        const globalIndex = i + batchIndex + index;
        try {
          const result = await processor(item, globalIndex);
          results.success.push({ index: globalIndex, item, result });
          results.processed++;
          
          if (onProgress) {
            onProgress({
              processed: results.processed,
              total: results.total,
              percentage: Math.round((results.processed / results.total) * 100)
            });
          }
          
          return { success: true, index: globalIndex, result };
        } catch (error) {
          results.failed.push({ index: globalIndex, item, error: error.message });
          results.processed++;
          
          if (onProgress) {
            onProgress({
              processed: results.processed,
              total: results.total,
              percentage: Math.round((results.processed / results.total) * 100)
            });
          }
          
          return { success: false, index: globalIndex, error: error.message };
        }
      });

      batchPromises.push(...concurrentPromises);
      batchIndex += maxConcurrency;

      // Wait for current concurrent batch before starting next
      await Promise.all(concurrentPromises);
    }
  }

  return results;
}

/**
 * Execute bulk database updates in optimized batches
 * @param {Object} connection - Database connection
 * @param {Array} updates - Array of {query, params} objects
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} Results with success/failure counts
 */
async function executeBulkUpdates(connection, updates, options = {}) {
  const {
    batchSize = 500, // Larger batches for DB operations
    useTransaction = true
  } = options;

  const results = {
    success: 0,
    failed: 0,
    errors: []
  };

  if (useTransaction) {
    await connection.beginTransaction();
  }

  try {
    // Process in batches
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      
      // Use prepared statements for better performance
      const batchPromises = batch.map(async (update) => {
        try {
          const [result] = await connection.query(update.query, update.params);
          results.success++;
          return { success: true, result };
        } catch (error) {
          results.failed++;
          results.errors.push({
            query: update.query.substring(0, 50) + '...',
            error: error.message
          });
          return { success: false, error: error.message };
        }
      });

      await Promise.all(batchPromises);
    }

    if (useTransaction) {
      await connection.commit();
    }

    return results;
  } catch (error) {
    if (useTransaction) {
      await connection.rollback();
    }
    throw error;
  }
}

/**
 * Optimized bulk insert using INSERT ... VALUES with multiple rows
 * @param {Object} connection - Database connection
 * @param {string} table - Table name
 * @param {Array} columns - Column names
 * @param {Array} rows - Array of value arrays
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} Results
 */
async function bulkInsert(connection, table, columns, rows, options = {}) {
  const {
    batchSize = 1000, // MySQL can handle 1000+ rows per INSERT
    useTransaction = true
  } = options;

  if (rows.length === 0) {
    return { success: 0, failed: 0 };
  }

  if (useTransaction) {
    await connection.beginTransaction();
  }

  try {
    const columnList = columns.join(', ');
    const placeholders = `(${columns.map(() => '?').join(', ')})`;
    let totalInserted = 0;

    // Process in batches
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      
      // Build VALUES clause
      const values = batch.map(() => placeholders).join(', ');
      const flatParams = batch.flat();
      
      const query = `INSERT INTO ${table} (${columnList}) VALUES ${values}`;
      
      try {
        const [result] = await connection.query(query, flatParams);
        totalInserted += result.affectedRows;
      } catch (error) {
        // If batch fails, try individual inserts for this batch
        console.warn(`Batch insert failed, falling back to individual inserts:`, error.message);
        
        for (const row of batch) {
          try {
            const singleQuery = `INSERT INTO ${table} (${columnList}) VALUES ${placeholders}`;
            await connection.query(singleQuery, row);
            totalInserted++;
          } catch (singleError) {
            console.error(`Failed to insert row:`, singleError.message);
          }
        }
      }
    }

    if (useTransaction) {
      await connection.commit();
    }

    return {
      success: totalInserted,
      failed: rows.length - totalInserted
    };
  } catch (error) {
    if (useTransaction) {
      await connection.rollback();
    }
    throw error;
  }
}

module.exports = {
  processInBatches,
  executeBulkUpdates,
  bulkInsert
};

