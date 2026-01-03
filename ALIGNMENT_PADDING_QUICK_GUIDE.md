# Alignment & Padding Quick Reference Guide

## 🎯 What's New

### Step 2: Text Alignment Controls
Each content section (Top, Middle, Bottom) now has alignment buttons:
- **Left** ◀ - Align text to the left
- **Center** ▣ - Center text (default)
- **Right** ▶ - Align text to the right

### Step 3: Section-Specific Padding
Individual padding controls for each section:
- **Top Section Padding**: Default 10px
- **Middle Section Padding**: Default 20px
- **Bottom Section Padding**: Default 10px

### Auto-Preview Update
Preview automatically updates when you change any value in Step 3 - no need to click "Update Preview" manually!

---

## 📍 Where to Find Them

### In Step 2 (Content)
```
┌─────────────────────────────────────────┐
│ Top Section (Optional)                  │
├─────────────────────────────────────────┤
│ Text Alignment                          │
│ [◀ Left] [▣ Center] [▶ Right]          │
│                                         │
│ Content Editor...                       │
└─────────────────────────────────────────┘
```

### In Step 3 (Styling)
Located in the left sidebar, scroll down to find:
```
┌─────────────────────────────────────────┐
│ Section Padding (px)                    │
├─────────────────────────────────────────┤
│ Top Section Padding    [ 10 ]           │
│ Middle Section Padding [ 20 ]           │
│ Bottom Section Padding [ 10 ]           │
└─────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Setting Up Alignment

1. **Go to Step 2** - Certificate Content
2. For each section you want to use:
   - Type your content
   - Click the alignment button (Left/Center/Right)
   - The button turns blue when active
3. **Click Next** to proceed to Step 3

### Adjusting Section Padding

1. **Go to Step 3** - Styling & Adjustments
2. Scroll in the left sidebar to "Section Padding (px)"
3. Enter padding values in pixels:
   - Smaller values = tighter spacing
   - Larger values = more whitespace
4. **Preview updates automatically!**

---

## 💡 Common Use Cases

### Formal Certificate Layout
```
Top Section:     Center - "CERTIFICATE OF ACHIEVEMENT"
                 Padding: 10px

Middle Section:  Center - Main content with student details
                 Padding: 30px (more space for emphasis)

Bottom Section:  Center - "Issued on [date]"
                 Padding: 10px
```

### Modern Layout
```
Top Section:     Left - College name
                 Padding: 15px

Middle Section:  Left - Certificate content
                 Padding: 25px

Bottom Section:  Right - Signatures and date
                 Padding: 15px
```

### Compact Layout
```
Top Section:     Center - Title
                 Padding: 5px

Middle Section:  Center - Content
                 Padding: 10px

Bottom Section:  Center - Footer
                 Padding: 5px
```

---

## 🎨 Visual Examples

### Left Alignment
```
┌──────────────────────────┐
│ CERTIFICATE              │
│ This is to certify...    │
│ Name: John Doe           │
└──────────────────────────┘
```

### Center Alignment (Default)
```
┌──────────────────────────┐
│      CERTIFICATE         │
│  This is to certify...   │
│     Name: John Doe       │
└──────────────────────────┘
```

### Right Alignment
```
┌──────────────────────────┐
│              CERTIFICATE │
│    ...to certify that    │
│           John Doe       │
└──────────────────────────┘
```

---

## 🔧 Tips & Best Practices

### Alignment
✅ **Do:**
- Use center alignment for formal certificates
- Use left alignment for letter-style documents
- Use right alignment for dates and signatures
- Mix alignments for visual interest

❌ **Don't:**
- Use right alignment for long paragraphs (hard to read)
- Mix too many alignments (looks messy)

### Section Padding
✅ **Do:**
- Use larger padding (20-50px) for important sections
- Use consistent padding for similar sections
- Test different values to find what looks best
- Use smaller padding for compact certificates

❌ **Don't:**
- Use negative values (won't work)
- Set padding too large (>100px, wastes space)
- Forget to check the preview

---

## 🐛 Troubleshooting

### Alignment buttons not showing
- **Solution**: Refresh the page (Ctrl+F5)
- Check you're on Step 2

### Padding changes not visible
- **Solution**: Wait 1-2 seconds for auto-preview
- Check you're on Step 3
- Verify values are positive numbers

### Preview not updating
- **Solution**: Check browser console for errors
- Make sure middle section has content
- Try clicking "Update Preview" manually

### Values not saving
- **Solution**: Complete all steps and save
- Check database migration ran successfully
- Verify no console errors

---

## 📊 Default Values

| Field                   | Default Value |
|-------------------------|---------------|
| Top Alignment           | center        |
| Middle Alignment        | center        |
| Bottom Alignment        | center        |
| Top Section Padding     | 10px          |
| Middle Section Padding  | 20px          |
| Bottom Section Padding  | 10px          |

---

## 🎓 Step-by-Step Tutorial

### Creating a Custom Certificate

1. **Start Wizard** - Services → Add New Service
2. **Step 1** - Enter service name, select college
3. **Step 2** - Content Entry:
   ```
   Top Section:
   - Type: "CERTIFICATE OF EXCELLENCE"
   - Alignment: Click [Center]
   
   Middle Section:
   - Type: "This certifies that @student_name..."
   - Alignment: Click [Left]
   
   Bottom Section:
   - Type: "Issued on @date"
   - Alignment: Click [Right]
   ```
4. **Click Next** to Step 3
5. **Step 3** - Styling:
   - Scroll to "Section Padding (px)"
   - Top Section Padding: 15
   - Middle Section Padding: 40
   - Bottom Section Padding: 15
   - Watch preview update automatically!
6. **Click Next** to review
7. **Save** the service

---

## 📱 Keyboard Shortcuts

Currently, there are no specific keyboard shortcuts for alignment and padding controls. Use mouse or touch to interact with buttons and input fields.

---

## 🔄 Updating Existing Certificates

To add alignment and padding to existing certificates:

1. Navigate to **Services** → **Manage Services**
2. Click **Edit** on the service
3. Wizard opens with existing data
4. Go to **Step 2** - Set alignments
5. Go to **Step 3** - Set section padding
6. **Save** changes

**Note**: Existing certificates will use default values (center alignment, 10/20/10 padding) until you update them.

---

## 🌐 Browser Support

| Feature          | Chrome | Firefox | Edge | Safari |
|------------------|--------|---------|------|--------|
| Alignment Buttons| ✅     | ✅      | ✅   | ✅     |
| Section Padding  | ✅     | ✅      | ✅   | ✅     |
| Auto-Preview     | ✅     | ✅      | ✅   | ✅     |

---

## 📞 Need Help?

### Common Questions

**Q: Can I use different alignments for different lines?**
A: No, alignment applies to the entire section. Use line breaks for multi-line content.

**Q: What's the maximum padding value?**
A: Technically unlimited, but recommend staying under 100px for best results.

**Q: Do alignment settings affect PDF output?**
A: Yes! The PDF will reflect your alignment and padding choices.

**Q: Can I preview alignment before saving?**
A: Yes, in Step 3 the preview shows all your styling including alignment.

---

## ✅ Quick Checklist

Before saving your certificate:
- [ ] Set alignment for each section you're using
- [ ] Adjust section padding as needed
- [ ] Check preview looks correct
- [ ] Test with sample data
- [ ] Save the service
- [ ] Generate a test certificate

---

## 📚 Related Features

- **Global Padding**: Left, Right, Top, Bottom (for page margins)
- **Section Spacing**: Top, Middle, Bottom (space between sections)
- **Font Size**: Applies to all text
- **Line Spacing**: Space between lines within sections

**Together these give you complete control over certificate layout!**

---

## 🎉 Summary

| Feature              | Location | Options        | Default |
|---------------------|----------|----------------|---------|
| Text Alignment      | Step 2   | L / C / R      | Center  |
| Section Padding     | Step 3   | 0-999px        | 10/20/10|
| Auto-Preview Update | Step 3   | Automatic      | Enabled |

**Happy Certificate Designing! 🎓**

---

**Version**: 1.0  
**Last Updated**: December 2024  
**Status**: ✅ Active