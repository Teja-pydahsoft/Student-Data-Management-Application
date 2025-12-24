export const getBonafideTemplate = () => {
    // A4 Portrait dimensions: 595 x 842 points
    const pageWidth = 595;
    const center = (width) => (pageWidth - width) / 2;

    return [
        // --- Header (Centered Standard College Header) ---
        // Logo
        {
            id: 'logo',
            type: 'image',
            content: 'logo', // Special keyword for college logo
            x: 480, // Top Right
            y: 30,
            width: 80,
            height: 60
        },
        // College Name - CENTERED
        {
            id: 'college_name', // Static header part
            type: 'text',
            content: '{{college_name}}', // Variable
            x: center(500),
            y: 40,
            fontSize: 22,
            font: 'Bold',
            align: 'center',
            width: 500, // Wide enough to center
            color: '#000000'
        },
        // Subtitle 1 - CENTERED
        {
            id: 'header_sub1',
            type: 'text',
            content: '(Approved by AICTE, New Delhi and Affiliated to JNTUK, Kakinada)',
            x: center(500),
            y: 68,
            fontSize: 10,
            font: 'Helvetica',
            align: 'center',
            width: 500,
            color: '#000000'
        },
        // Accredited Line - CENTERED
        {
            id: 'header_sub2',
            type: 'text',
            content: 'Accredited by NAAC "A" & AUTONOMOUS INSTITUTIONS',
            x: center(500),
            y: 82,
            fontSize: 10,
            font: 'Bold',
            align: 'center',
            width: 500,
            color: '#000000'
        },
        // Address - CENTERED
        {
            id: 'header_addr',
            type: 'text',
            content: '{{college_address}}', // Variable
            x: center(500),
            y: 96,
            fontSize: 10,
            font: 'Helvetica',
            align: 'center',
            width: 500,
            color: '#000000'
        },
        // Contact Info Row - CENTERED
        {
            id: 'header_contact',
            type: 'text',
            content: 'EMAIL ID: {{college_email}}             WEBSITE: {{college_website}}', // Variables but kept placeholders if needed, simpler to keep static if vars not reliably populated, but user asked for variables. Let's use vars if available or safely fallback in renderer if needed. 'college_email' and 'college_website' were not in my strict list earlier but usually exist. I will use generic text if variables are missing in display.
            // Actually, safe bet is to use variables if I'm sure they exist in the backend data map.
            // In pdfService.js: college_address, college_phone, college_email ARE mapped.
            // So: EMAIL ID: {{college_email}}   WEBSITE: {{college_website}}
            x: center(550),
            y: 115,
            fontSize: 10,
            font: 'Bold',
            align: 'center',
            width: 550,
            color: '#000000'
        },
        // Line Separator
        {
            id: 'header_line',
            type: 'line',
            x: 30, // Margin left
            y: 135,
            width: 535, // Margin right 30 (595 - 60)
            height: 0,
            color: '#000000',
            strokeWidth: 1.5
        },

        // --- Meta Info (Lr.No and Date) ---
        {
            id: 'lr_no',
            type: 'text',
            content: 'Lr.No. PYDE/Service/{{current_year}}',
            x: 50,
            y: 160,
            fontSize: 12,
            font: 'Helvetica',
            align: 'left',
            width: 250,
            color: '#000000'
        },
        {
            id: 'date_label',
            type: 'text',
            content: 'Date: {{date}}',
            x: 400,
            y: 160,
            fontSize: 12,
            font: 'Helvetica',
            align: 'right',
            width: 150,
            color: '#000000'
        },

        // --- Title ---
        {
            id: 'cert_title',
            type: 'text',
            content: 'BONAFIDE CERTIFICATE',
            x: center(300),
            y: 220, // Moved up slightly to balance space
            fontSize: 18,
            font: 'Bold',
            align: 'center',
            width: 300,
            color: '#000000'
        },
        // Underline for Title
        {
            id: 'title_underline',
            type: 'line',
            x: center(230),
            y: 245,
            width: 230,
            height: 0,
            color: '#000000',
            strokeWidth: 1
        },

        // --- Body Paragraph ---
        // Refined alignment to look more "centered" as a block while keeping left alignment for reading
        // Line 1: "This is to certify that [NAME]"
        {
            id: 'body_line1_pre',
            type: 'text',
            content: 'This is to certify that ',
            x: 50,
            y: 300,
            fontSize: 14,
            font: 'Helvetica',
            align: 'left',
            width: 150,
            color: '#000000'
        },
        {
            id: 'student_name',
            type: 'text',
            content: '{{student_name}}',
            x: 200,
            y: 300,
            fontSize: 14,
            font: 'Bold',
            align: 'left',
            width: 350,
            color: '#000000'
        },

        // Line 2: "S/o, [PARENT] bearing Roll No: [PIN]"
        {
            id: 'body_line2_so',
            type: 'text',
            content: 'S/o, ',
            x: 50,
            y: 340,
            fontSize: 14,
            font: 'Helvetica',
            align: 'left',
            width: 40,
            color: '#000000'
        },
        {
            id: 'parent_name',
            type: 'text',
            content: '{{parent_name}}',
            x: 90,
            y: 340,
            fontSize: 14,
            font: 'Bold',
            align: 'left',
            width: 200,
            color: '#000000'
        },
        {
            id: 'body_line2_roll',
            type: 'text',
            content: ' bearing Roll No: ',
            x: 300,
            y: 340,
            fontSize: 14,
            font: 'Helvetica',
            align: 'left',
            width: 120,
            color: '#000000'
        },
        {
            id: 'pin_no',
            type: 'text',
            content: '{{pin_no}}',
            x: 420,
            y: 340,
            fontSize: 14,
            font: 'Bold',
            align: 'left',
            width: 130,
            color: '#000000'
        },

        // Line 3: "has Studied B.Tech during AY [YEAR] is a"
        {
            id: 'body_line3_pre',
            type: 'text',
            content: 'has Studied B.Tech during AY ',
            x: 50,
            y: 380,
            fontSize: 14,
            font: 'Helvetica',
            align: 'left',
            width: 220,
            color: '#000000'
        },
        {
            id: 'acad_year',
            type: 'text',
            content: '{{academic_year}}',
            x: 270,
            y: 380,
            fontSize: 14,
            font: 'Bold',
            align: 'left',
            width: 100,
            color: '#000000'
        },
        {
            id: 'body_line3_post',
            type: 'text',
            content: ' is a',
            x: 370,
            y: 380,
            fontSize: 14,
            font: 'Helvetica',
            align: 'left',
            width: 50,
            color: '#000000'
        },

        // Line 4: "bonafide student of our college, [COLLEGE]"
        {
            id: 'body_line4_pre',
            type: 'text',
            content: 'bonafide student of our college, ',
            x: 50,
            y: 420,
            fontSize: 14,
            font: 'Helvetica',
            align: 'left',
            width: 230,
            color: '#000000'
        },
        {
            id: 'college_name_body',
            type: 'text',
            content: '{{college_name}}',
            x: 280,
            y: 420,
            fontSize: 14,
            font: 'Bold',
            align: 'left',
            width: 250,
            color: '#000000'
        },

        // Line 5: ". Who is studying his [YEAR] YEAR [BRANCH] Affiliated University i.e."
        {
            id: 'body_line5_pre',
            type: 'text',
            content: '. Who is studying his ',
            x: 50,
            y: 460,
            fontSize: 14,
            font: 'Helvetica',
            align: 'left',
            width: 150,
            color: '#000000'
        },
        {
            id: 'year_branch',
            type: 'text',
            content: '{{current_year_text}} YEAR {{branch}}',
            x: 200,
            y: 460,
            fontSize: 14,
            font: 'Bold',
            align: 'left',
            width: 300,
            color: '#000000'
        },
        {
            id: 'body_line5_post',
            type: 'text',
            content: ' Affiliated University i.e.',
            x: 450, // Moved right to clear the branch var
            y: 460,
            fontSize: 14,
            font: 'Helvetica',
            align: 'left',
            width: 150,
            color: '#000000'
        },

        // Line 6: "Jawaharlal Nehru Technological University, Kakinada."
        {
            id: 'body_line6',
            type: 'text',
            content: 'Jawaharlal Nehru Technological University, Kakinada.',
            x: 50,
            y: 500,
            fontSize: 14,
            font: 'Helvetica',
            align: 'left',
            width: 500,
            color: '#000000'
        },


        // --- Footer ---
        {
            id: 'seal_label',
            type: 'text',
            content: 'Seal:',
            x: 60,
            y: 650,
            fontSize: 14,
            font: 'Helvetica',
            align: 'left',
            width: 100,
            color: '#000000'
        },
        {
            id: 'principal_label',
            type: 'text',
            content: 'PRINCIPAL',
            x: 400,
            y: 650,
            fontSize: 14,
            font: 'Bold',
            align: 'center',
            width: 150,
            color: '#000000'
        }
    ];
};
