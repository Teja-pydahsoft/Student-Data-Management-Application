# Troubleshooting Guide

## Common Issues and Solutions

### 500 Error When Publishing Certificate Service

#### Problem Description
When trying to publish a service in Step 3 of the Add Service Wizard, the application returns a 500 Internal Server Error:

```
PUT http://localhost:5000/api/certificate-templates/3 500 (Internal Server Error)
API Error: 500 {success: false, message: 'Server error'}
```

#### Root Cause
The database schema was missing required columns that the backend controller was trying to update. Specifically, the following columns were missing from the `certificate_templates` table:

- `top_alignment`
- `middle_alignment`
- `bottom_alignment`
- `top_section_padding`
- `middle_section_padding`
- `bottom_section_padding`
- `font_size`
- `line_spacing`
- `header_height`
- `footer_height`

#### Why Migrations Failed
The migration files used MySQL syntax `ADD COLUMN IF NOT EXISTS` which is not supported in all MySQL versions. The migrations were marked as "executed" in the `schema_migrations` table, but the actual column creation failed silently.

#### Solution Applied
1. **Fixed Migration Files**: Removed the `IF NOT EXISTS` clause from migration SQL files to use standard MySQL `ALTER TABLE` syntax.

2. **Manually Added Missing Columns**: Ran SQL commands to add all missing columns with proper defaults:
   - Alignment columns: ENUM('left', 'center', 'right') with DEFAULT 'center'
   - Section padding columns: INT with appropriate defaults (10, 20, 10)
   - Typography columns: INT for font_size (default 12), DECIMAL(3,1) for line_spacing (default 1.5)
   - Image size columns: INT for header_height (default 80) and footer_height (default 60)

3. **Verified Schema**: Confirmed all 29 columns are now present in the `certificate_templates` table.

#### How to Verify the Fix
1. Check database schema:
   ```bash
   cd backend
   node -e "const { masterPool } = require('./config/database'); masterPool.query('SHOW COLUMNS FROM certificate_templates').then(([cols]) => { console.log(cols.map(c => c.Field)); process.exit(0); });"
   ```

2. Expected output should include all these columns:
   - id, service_id, college_id
   - top_content, top_alignment, middle_content, middle_alignment, bottom_content, bottom_alignment
   - padding_left, padding_right, padding_top, padding_bottom
   - top_section_padding, middle_section_padding, bottom_section_padding
   - blank_variables, page_size, page_orientation
   - font_size, line_spacing, header_height, footer_height
   - top_spacing, middle_spacing, bottom_spacing
   - is_active, created_at, updated_at

3. Try publishing a service again - it should now work without errors.

#### Prevention for Future
- The migration runner now uses standard MySQL syntax compatible with all versions
- Migrations are tracked in the `schema_migrations` table
- On server startup, migrations automatically run if not already executed
- The fixed migration files will work correctly for fresh installations

#### Files Modified
- `backend/migrations/add_alignment_and_section_padding.sql` - Fixed SQL syntax
- `backend/migrations/add_typography_and_image_size_columns.sql` - Fixed SQL syntax

#### Related Components
- **Backend Controller**: `backend/controllers/certificateTemplateController.js` - Handles template CRUD operations
- **Frontend Service**: `frontend/src/services/certificateTemplateService.js` - API client
- **Frontend Component**: `frontend/src/pages/admin/AddServiceWizard.jsx` - Service creation wizard
- **Migration Runner**: `backend/scripts/runMigrations.js` - Automatic migration execution
- **Server Startup**: `backend/server.js` - Calls migration runner on startup

---

## Database Migration Issues

### Checking Migration Status
```bash
cd backend
node -e "const { masterPool } = require('./config/database'); masterPool.query('SELECT * FROM schema_migrations').then(([rows]) => { console.table(rows); process.exit(0); });"
```

### Force Re-running Migrations
If migrations failed but were marked as executed:

1. **Delete migration records** (only if you're sure the migration didn't complete):
   ```sql
   DELETE FROM schema_migrations WHERE migration_name = 'migration_file_name.sql';
   ```

2. **Restart the server** - migrations will auto-run on startup

3. **Or manually run migrations**:
   ```bash
   cd backend
   node -e "const { runMigrations } = require('./scripts/runMigrations'); runMigrations().then(() => process.exit(0));"
   ```

### Common Migration Errors

#### ER_DUP_FIELDNAME
**Error**: Duplicate column name

**Cause**: Trying to add a column that already exists

**Solution**: Migration runner handles this automatically and continues

#### ER_PARSE_ERROR
**Error**: SQL syntax error

**Cause**: Using MySQL version-specific syntax (like `IF NOT EXISTS` on older versions)

**Solution**: Use standard SQL syntax compatible with all MySQL versions

---

## Server Errors

### 500 Internal Server Error
- Check server console for detailed error messages
- Verify database schema matches controller expectations
- Check for missing or incorrectly typed columns
- Ensure all required fields are being sent from frontend

### Database Connection Issues
- Verify `.env` file has correct database credentials
- Check if MySQL server is running
- Verify database exists and user has proper permissions

---

## Frontend Issues

### React Warnings About defaultProps
**Warning**: `Support for defaultProps will be removed from function components in a future major release`

**Cause**: The `react-mentions` library uses deprecated React patterns

**Impact**: This is just a deprecation warning and doesn't affect functionality

**Solution**: No immediate action needed. Library will need to be updated when React removes support.

---

## Getting Help

If you encounter issues not covered in this guide:

1. Check the browser console for frontend errors
2. Check the server console for backend errors
3. Verify database schema with `DESCRIBE certificate_templates`
4. Check migration status in `schema_migrations` table
5. Review the detailed conversation thread for context