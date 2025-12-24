import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { serviceService } from '../../services/serviceService';
import { toast } from 'react-hot-toast';
import { Save, ArrowLeft, Type, Image as ImageIcon, Minus, Square, Circle, Trash2, MousePointer, LayoutTemplate } from 'lucide-react';
import { getTCTemplate } from './templates/certificates/tcTemplate';
import { getStudyConductTemplate } from './templates/certificates/studyConductTemplate';
import { getBonafideTemplate } from './templates/certificates/bonafideTemplate';

const CertificateDesigner = () => {
    const { serviceId } = useParams();
    const navigate = useNavigate();
    const [service, setService] = useState(null);
    const [loading, setLoading] = useState(true);
    const [elements, setElements] = useState([]);
    const [selectedElementId, setSelectedElementId] = useState(null);
    const [canvasSize, setCanvasSize] = useState({ width: 595, height: 842 }); // Default A4 Portrait

    // Drag & Drop State
    const [draggingId, setDraggingId] = useState(null);
    const dragOffset = useRef({ x: 0, y: 0 });

    // Resize State
    const [resizingId, setResizingId] = useState(null);
    const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0, radius: 0 });

    // Image Upload State
    const fileInputRef = useRef(null);
    const replacingImageId = useRef(null);

    // Inline Edit State
    const [editingId, setEditingId] = useState(null);

    useEffect(() => {
        fetchService();

        const handleMouseUp = () => {
            setDraggingId(null);
            setResizingId(null);
        };

        const handleMouseMove = (e) => {
            const canvas = document.getElementById('canvas-area');
            if (!canvas) return;
            const rect = canvas.getBoundingClientRect();

            // --- Resizing Logic ---
            if (resizingId) {
                const deltaX = e.clientX - resizeStart.current.x;
                const deltaY = e.clientY - resizeStart.current.y;

                setElements(prev => prev.map(el => {
                    if (el.id === resizingId) {
                        if (el.type === 'circle') {
                            const newRadius = Math.max(10, resizeStart.current.radius + deltaX / 2);
                            return { ...el, radius: newRadius };
                        } else {
                            const newWidth = Math.max(10, resizeStart.current.width + deltaX);
                            const newHeight = Math.max(10, resizeStart.current.height + deltaY);
                            return { ...el, width: newWidth, height: newHeight };
                        }
                    }
                    return el;
                }));
                return;
            }

            // --- Dragging Logic ---
            if (draggingId) {
                const x = e.clientX - rect.left - dragOffset.current.x;
                const y = e.clientY - rect.top - dragOffset.current.y;

                setElements(prev => prev.map(el => {
                    if (el.id === draggingId) {
                        return { ...el, x, y };
                    }
                    return el;
                }));
            }
        };

        window.addEventListener('mouseup', handleMouseUp);
        window.addEventListener('mousemove', handleMouseMove);

        return () => {
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('mousemove', handleMouseMove);
        };
    }, [draggingId, resizingId, serviceId]);

    // Keyboard Navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!selectedElementId || editingId) return; // Don't move if typing in text

            // Grid size for movement (1px usually, maybe shift for 10px)
            const step = e.shiftKey ? 10 : 1;

            switch (e.key) {
                case 'ArrowUp':
                    e.preventDefault();
                    setElements(prev => prev.map(el => el.id === selectedElementId ? { ...el, y: el.y - step } : el));
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    setElements(prev => prev.map(el => el.id === selectedElementId ? { ...el, y: el.y + step } : el));
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    setElements(prev => prev.map(el => el.id === selectedElementId ? { ...el, x: el.x - step } : el));
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    setElements(prev => prev.map(el => el.id === selectedElementId ? { ...el, x: el.x + step } : el));
                    break;
                case 'Delete':
                case 'Backspace':
                    if (selectedElementId && !editingId) {
                        // Optional: Allow delete key
                        // removeElement(selectedElementId); // Need to move removeElement out or refs
                    }
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedElementId, editingId]); // Re-bind when selection changes if using state directly (better to use functional state updates which we did)

    const fetchService = async () => {
        try {
            const response = await serviceService.getAllServices();
            const foundService = response.data.find(s => s.id === parseInt(serviceId));
            if (foundService) {
                setService(foundService);
                if (foundService.template_config) {
                    try {
                        const config = typeof foundService.template_config === 'string'
                            ? JSON.parse(foundService.template_config)
                            : foundService.template_config;

                        if (config.elements) {
                            setElements(config.elements.map((el, idx) => ({ ...el, id: idx + Date.now() })));
                        }

                        // Load saved canvas size or fallback to legacy logic
                        if (config.canvasWidth && config.canvasHeight) {
                            setCanvasSize({ width: config.canvasWidth, height: config.canvasHeight });
                        } else {
                            // Legacy fallback
                            if (config.size === 'A4' && config.layout === 'landscape') {
                                setCanvasSize({ width: 842, height: 595 });
                            }
                        }
                    } catch (e) {
                        console.error("Config parse error", e);
                    }
                }
            } else {
                toast.error('Service not found');
                navigate('/services/config');
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to load service');
        } finally {
            setLoading(false);
        }
    };

    // --- Element Creators ---
    const addText = (props = {}) => {
        const newEl = {
            id: Date.now(),
            type: 'text',
            content: 'Double Click to Edit',
            x: 297, y: 421, // Center of A4
            fontSize: 16,
            font: 'Helvetica',
            color: '#000000',
            width: 200,
            height: 30, // Default height for easier editing
            align: 'left',
            ...props
        };
        setElements(prev => [...prev, newEl]);
        setSelectedElementId(newEl.id);
        return newEl;
    };

    const addRect = (props = {}) => {
        const newEl = {
            id: Date.now(),
            type: 'rect',
            x: 250, y: 370,
            width: 100, height: 100,
            stroke: true, fill: null,
            color: '#000000', lineWidth: 1,
            ...props
        };
        setElements(prev => [...prev, newEl]);
        setSelectedElementId(newEl.id);
    };

    const addCircle = (props = {}) => {
        const newEl = {
            id: Date.now(),
            type: 'circle',
            x: 250, y: 370,
            radius: 50,
            stroke: true, fill: null,
            color: '#000000', lineWidth: 1,
            ...props
        };
        setElements(prev => [...prev, newEl]);
        setSelectedElementId(newEl.id);
    };

    const addLine = (props = {}) => {
        const newEl = {
            id: Date.now(),
            type: 'line',
            x: 200, y: 400,
            width: 200, height: 2,
            color: '#000000', lineWidth: 1,
            x1: 50, y1: 50, x2: 250, y2: 50,
            ...props
        };
        setElements(prev => [...prev, newEl]);
        setSelectedElementId(newEl.id);
    };

    const addImage = (type = 'logo', props = {}) => {
        const newEl = {
            id: Date.now(),
            type: 'image',
            content: type,
            x: 250, y: 370,
            width: 100, height: 100,
            ...props
        };
        setElements(prev => [...prev, newEl]);
        setSelectedElementId(newEl.id);
    };

    const loadTCTemplate = () => {
        if (!window.confirm("This will replace your current design. Continue?")) return;

        const tcElements = getTCTemplate();
        // Regenerate IDs to be unique timestamps
        const finalElements = tcElements.map((el, i) => ({ ...el, id: Date.now() + i }));
        setElements(finalElements);
        setCanvasSize({ width: 595, height: 842 }); // Force A4
    };

    const loadStudyConductTemplate = () => {
        if (!window.confirm("This will replace your current design. Continue?")) return;

        const scElements = getStudyConductTemplate();
        // Regenerate IDs
        const finalElements = scElements.map((el, i) => ({ ...el, id: Date.now() + i }));
        setElements(finalElements);
        setCanvasSize({ width: 595, height: 420 }); // Force A5 Landscape (595x420)
    };

    const loadBonafideTemplate = () => {
        if (!window.confirm("This will replace your current design. Continue?")) return;
        const bElements = getBonafideTemplate();
        const finalElements = bElements.map((el, i) => ({ ...el, id: Date.now() + i }));
        setElements(finalElements);
        setCanvasSize({ width: 595, height: 842 }); // Force A4
    };

    // --- Updates ---
    const updateElement = (id, updates) => {
        setElements(elements.map(el => el.id === id ? { ...el, ...updates } : el));
    };

    const removeElement = (id) => {
        setElements(elements.filter(el => el.id !== id));
        if (selectedElementId === id) setSelectedElementId(null);
    };

    const saveConfig = async () => {
        if (!service) return;
        try {
            const cleanElements = elements.map(({ id, ...rest }) => rest);
            const config = {
                canvasWidth: canvasSize.width,
                canvasHeight: canvasSize.height,
                elements: cleanElements
            };

            await serviceService.updateService(service.id, {
                ...service,
                template_config: config,
                template_type: 'dynamic'
            });
            toast.success('Certificate design saved successfully');
        } catch (error) {
            console.error(error);
            toast.error('Failed to save design');
        }
    };

    // --- Mouse Interactions ---
    const handleMouseDown = (e, el) => {
        e.stopPropagation();
        // If we are already editing this one, don't reset
        if (editingId === el.id) return;

        // Clear editing state if switching elements
        if (editingId) setEditingId(null);

        setSelectedElementId(el.id);
        // If it's text, we can optionally enable editing on click if desired, 
        // but usually single click = properties, double click = inline text.
        // Let's stick to properties on click.

        const canvas = document.getElementById('canvas-area');
        const rect = canvas.getBoundingClientRect();
        const xOffset = e.clientX - rect.left - el.x;
        const yOffset = e.clientY - rect.top - el.y;
        dragOffset.current = { x: xOffset, y: yOffset };
        setDraggingId(el.id);
    };

    const handleResizeMouseDown = (e, el) => {
        e.stopPropagation();
        resizeStart.current = { x: e.clientX, y: e.clientY, width: el.width, height: el.height, radius: el.radius };
        setResizingId(el.id);
    };

    const handleDoubleClick = (e, el) => {
        e.stopPropagation();
        if (el.type === 'text') {
            setEditingId(el.id);
        } else if (el.type === 'image') {
            replacingImageId.current = el.id;
            fileInputRef.current?.click();
        }
        setSelectedElementId(el.id);
    };



    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file && replacingImageId.current) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                updateElement(replacingImageId.current, { content: ev.target.result });
                replacingImageId.current = null;
            };
            reader.readAsDataURL(file);
        }
    };

    const activeElement = elements.find(el => el.id === (editingId || selectedElementId));

    const variables = [
        'student_name', 'admission_number', 'pin_no', 'course', 'branch',
        'current_year', 'current_semester', 'dob', 'email', 'phone_number',
        'college_name', 'college_address', 'college_email', 'college_website', 'date', 'parent_name', 'religion',
        'gender', 'caste', 'admission_date', 'serial_no', 'mole_1', 'mole_2',
        'reason', 'conduct', 'date_of_leaving', 'promoted', 'current_year_text', 'academic_year'
    ];

    // Mock Data for Preview
    const previewData = {
        // College details removed to show variables directly
        current_year: '2024-25',
        date: new Date().toLocaleDateString('en-GB'),
        student_name: '___________________________________',
        parent_name: '____________________',
        pin_no: '__________',
        academic_year: '__________',
        course: '__________',
        branch: '____________________',
        current_year_text: '____',
        current_semester: '__',
    };

    const replaceVariables = (text) => {
        if (!text) return '';
        return text.replace(/{{(.*?)}}/g, (match, p1) => {
            const key = p1.trim();
            return previewData[key] !== undefined ? previewData[key] : match;
        });
    };

    const paperSizes = [
        { name: 'A3', width: 842, height: 1190 },
        { name: 'A4', width: 595, height: 842 },
        { name: 'A5', width: 420, height: 595 },
        { name: 'Letter', width: 612, height: 792 },
        { name: 'Legal', width: 612, height: 1008 }
    ];

    if (loading) return <div className="p-10 text-center">Loading designer...</div>;

    return (
        <div className="h-screen flex flex-col bg-gray-50 overflow-hidden text-sm">
            {/* Header */}
            <div className="h-14 bg-white border-b flex items-center justify-between px-4 shadow-sm z-20 shrink-0">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/services/config')} className="p-1.5 hover:bg-gray-100 rounded-lg">
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <h1 className="font-bold text-gray-800">{service?.name}</h1>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider">Certificate Designer</p>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
                    <ToolButton icon={<Type size={16} />} label="Text" onClick={() => addText()} />
                    <ToolButton icon={<Square size={16} />} label="Rect" onClick={() => addRect()} />
                    <ToolButton icon={<Circle size={16} />} label="Circle" onClick={() => addCircle()} />
                    <ToolButton icon={<Minus size={16} />} label="Line" onClick={() => addLine()} />
                    <ToolButton icon={<ImageIcon size={16} />} label="Logo" onClick={() => addImage('logo')} />
                    <div className="w-px h-8 bg-gray-300 mx-1"></div>
                    <ToolButton icon={<LayoutTemplate size={16} />} label="TC Template" onClick={loadTCTemplate} />
                    <ToolButton icon={<LayoutTemplate size={16} />} label="S&C Template" onClick={loadStudyConductTemplate} />
                    <ToolButton icon={<LayoutTemplate size={16} />} label="Bonafide" onClick={loadBonafideTemplate} />
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                        {Math.round(canvasSize.width)} x {Math.round(canvasSize.height)} px
                    </span>
                    <button onClick={saveConfig} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg font-medium shadow-sm transition-colors">
                        <Save size={16} /> Save
                    </button>
                </div>
            </div>

            {/* Main Workspace */}
            <div className="flex-1 flex overflow-hidden">
                {/* Canvas Area */}
                <div className="flex-1 overflow-auto bg-gray-200/50 p-8 flex justify-center items-start relative scroll-smooth">
                    <div
                        id="canvas-area"
                        className="bg-white shadow-xl relative transition-shadow duration-300 ease-in-out shrink-0"
                        style={{
                            width: canvasSize.width,
                            height: canvasSize.height,
                        }}
                        onClick={() => {
                            setSelectedElementId(null);
                            setEditingId(null);
                        }}
                    >
                        {/* Grid Lines (Visual Aid) */}
                        <div className="absolute inset-0 pointer-events-none opacity-5" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

                        {elements.map(el => (
                            <div
                                key={el.id}
                                className={`absolute group select-none ${selectedElementId === el.id ? 'ring-2 ring-indigo-500 z-10' : 'hover:ring-1 hover:ring-indigo-300'}`}
                                style={{
                                    left: el.x,
                                    top: el.y,
                                    width: el.type === 'circle' ? el.radius * 2 : el.width,
                                    height: el.type === 'circle' ? el.radius * 2 : (el.type === 'line' ? el.lineWidth + 10 : el.height),
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: el.type === 'text' ? (el.align === 'center' ? 'center' : (el.align === 'right' ? 'flex-end' : 'flex-start')) : 'center',
                                    cursor: resizingId ? 'se-resize' : (draggingId ? 'grabbing' : 'move')
                                }}
                                onMouseDown={(e) => handleMouseDown(e, el)}
                                onDoubleClick={(e) => handleDoubleClick(e, el)}
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Content Render */}

                                {el.type === 'text' && (
                                    editingId === el.id ? (
                                        <textarea
                                            autoFocus
                                            className="w-full h-full bg-white bg-opacity-90 outline-none resize-none overflow-hidden text-black px-1"
                                            style={{
                                                fontSize: el.fontSize,
                                                fontFamily: (el.font === 'Bold' || el.font === 'Helvetica-Bold') ? 'sans-serif' : 'sans-serif',
                                                fontWeight: (el.font === 'Bold' || el.font === 'Helvetica-Bold') ? 'bold' : 'normal',
                                                textAlign: el.align
                                            }}
                                            value={el.content}
                                            onChange={(e) => updateElement(el.id, { content: e.target.value })}
                                            onBlur={() => setEditingId(null)}
                                            onMouseDown={(e) => e.stopPropagation()}
                                        />
                                    ) : (
                                        <span style={{
                                            fontSize: el.fontSize,
                                            fontFamily: (el.font === 'Bold' || el.font === 'Helvetica-Bold') ? 'sans-serif' : 'sans-serif',
                                            fontWeight: (el.font === 'Bold' || el.font === 'Helvetica-Bold') ? 'bold' : 'normal',
                                            color: el.color,
                                            width: '100%',
                                            textAlign: el.align,
                                            whiteSpace: 'pre-wrap',
                                            pointerEvents: 'none'
                                        }}>
                                            {replaceVariables(el.content)}
                                        </span>
                                    )
                                )}
                                {/* Edit Hint Overlay */}
                                {el.type === 'text' && !editingId && (
                                    <div
                                        className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-500 text-white rounded-bl shadow-sm cursor-pointer z-50"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingId(el.id);
                                            setSelectedElementId(el.id);
                                        }}
                                        onMouseDown={(e) => e.stopPropagation()}
                                        title="Click to Edit Text"
                                    >
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                        </svg>
                                    </div>
                                )}
                                {el.type === 'rect' && (
                                    <div style={{
                                        width: '100%', height: '100%',
                                        border: el.stroke ? `${el.lineWidth}px solid ${el.color}` : 'none',
                                        backgroundColor: el.fill || 'transparent'
                                    }} />
                                )}
                                {el.type === 'circle' && (
                                    <div style={{
                                        width: '100%', height: '100%', borderRadius: '50%',
                                        border: el.stroke ? `${el.lineWidth}px solid ${el.color}` : 'none',
                                        backgroundColor: el.fill || 'transparent'
                                    }} />
                                )}
                                {el.type === 'line' && (
                                    <div style={{
                                        width: '100%', height: el.lineWidth,
                                        backgroundColor: el.color
                                    }} />
                                )}
                                {el.type === 'image' && (
                                    <div className="w-full h-full bg-gray-100 flex items-center justify-center overflow-hidden border border-dashed border-gray-300">
                                        {el.content === 'logo' ? <span className="text-xs text-gray-400 font-bold">LOGO</span> : <img src={el.content} alt="" className="w-full h-full object-contain" draggable={false} />}
                                    </div>
                                )}

                                {/* Resize Handles */}
                                {selectedElementId === el.id && (
                                    <div
                                        className="absolute -bottom-1.5 -right-1.5 w-4 h-4 bg-white border-2 border-indigo-500 rounded-full cursor-se-resize z-30 shadow-md hover:scale-110 transition-transform"
                                        onMouseDown={(e) => handleResizeMouseDown(e, el)}
                                    ></div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Properties Panel */}
                <div className="w-80 bg-white border-l shadow-xl z-20 overflow-y-auto shrink-0 transition-all">
                    {activeElement ? (
                        <div className="p-5 space-y-6">
                            {activeElement.type === 'text' && (
                                <div className="mb-6">
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Content</h3>
                                    <textarea
                                        className="w-full border rounded-lg p-3 text-xs min-h-[120px] focus:ring-2 ring-indigo-500 outline-none bg-gray-50 focus:bg-white transition"
                                        value={activeElement.content}
                                        onChange={(e) => updateElement(activeElement.id, { content: e.target.value })}
                                        placeholder="Type content here..."
                                    ></textarea>

                                    <div className="mt-3">
                                        <div className="text-[10px] font-bold text-gray-400 mb-2">INSERT VARIABLE</div>
                                        <div className="flex flex-wrap gap-2 text-gray-500 max-h-32 overflow-y-auto custom-scrollbar">
                                            {variables.map(v => (
                                                <button
                                                    key={v}
                                                    onClick={() => updateElement(activeElement.id, { content: activeElement.content + ` {{${v}}}` })}
                                                    className="px-2 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-100 rounded text-[10px] font-medium transition"
                                                >
                                                    {v}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <hr className="border-gray-100 mt-6" />
                                </div>
                            )}

                            <div>
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Position & Size</h3>
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <InputGroup label="X" value={activeElement.x} onChange={v => updateElement(activeElement.id, { x: Number(v) })} type="number" />
                                        <InputGroup label="Y" value={activeElement.y} onChange={v => updateElement(activeElement.id, { y: Number(v) })} type="number" />
                                    </div>
                                    <div className="flex justify-center gap-2 p-2 bg-gray-50 rounded">
                                        <button onClick={() => updateElement(activeElement.id, { x: activeElement.x - 1 })} className="p-1.5 bg-white border rounded hover:bg-gray-100" title="Left"><ArrowLeft size={14} /></button>
                                        <div className="flex flex-col gap-1">
                                            <button onClick={() => updateElement(activeElement.id, { y: activeElement.y - 1 })} className="p-1.5 bg-white border rounded hover:bg-gray-100" title="Up"><ArrowLeft size={14} className="rotate-90" /></button>
                                            <button onClick={() => updateElement(activeElement.id, { y: activeElement.y + 1 })} className="p-1.5 bg-white border rounded hover:bg-gray-100" title="Down"><ArrowLeft size={14} className="-rotate-90" /></button>
                                        </div>
                                        <button onClick={() => updateElement(activeElement.id, { x: activeElement.x + 1 })} className="p-1.5 bg-white border rounded hover:bg-gray-100" title="Right"><ArrowLeft size={14} className="rotate-180" /></button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        {activeElement.type === 'circle' ? (
                                            <InputGroup label="Radius" value={activeElement.radius} onChange={v => updateElement(activeElement.id, { radius: Number(v) })} type="number" />
                                        ) : (
                                            <>
                                                <InputGroup label="Width" value={activeElement.width} onChange={v => updateElement(activeElement.id, { width: Number(v) })} type="number" />
                                                {activeElement.type !== 'line' && <InputGroup label="Height" value={activeElement.height} onChange={v => updateElement(activeElement.id, { height: Number(v) })} type="number" />}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <hr className="border-gray-100" />

                            <div>
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Styling</h3>
                                <div className="space-y-3">
                                    <InputGroup label="Color" value={activeElement.color} onChange={v => updateElement(activeElement.id, { color: v })} type="color" />

                                    {(activeElement.type === 'rect' || activeElement.type === 'circle') && (
                                        <InputGroup label="Fill Color" value={activeElement.fill || '#ffffff'} onChange={v => updateElement(activeElement.id, { fill: v })} type="color" />
                                    )}

                                    {activeElement.type === 'text' && (
                                        <>
                                            <InputGroup label="Font Size" value={activeElement.fontSize} onChange={v => updateElement(activeElement.id, { fontSize: Number(v) })} type="number" />
                                            <div>
                                                <label className="text-[10px] text-gray-500 font-medium">Font Weight</label>
                                                <select
                                                    className="w-full mt-1 border rounded p-1.5 text-xs bg-gray-50 focus:bg-white focus:ring-2 ring-indigo-100 outline-none transition"
                                                    value={activeElement.font}
                                                    onChange={(e) => updateElement(activeElement.id, { font: e.target.value })}
                                                >
                                                    <option value="Helvetica">Normal</option>
                                                    <option value="Helvetica-Bold">Bold</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-gray-500 font-medium">Align</label>
                                                <div className="flex bg-gray-100 rounded p-1 mt-1">
                                                    {['left', 'center', 'right'].map(a => (
                                                        <button
                                                            key={a}
                                                            onClick={() => updateElement(activeElement.id, { align: a })}
                                                            className={`flex-1 py-1 text-xs capitalize rounded ${activeElement.align === a ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                                                        >
                                                            {a}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {(activeElement.type !== 'text' && activeElement.type !== 'image') && (
                                        <InputGroup label="Line Width" value={activeElement.lineWidth} onChange={v => updateElement(activeElement.id, { lineWidth: Number(v) })} type="number" />
                                    )}
                                </div>
                            </div>



                            <div className="pt-6">
                                <button
                                    onClick={() => removeElement(activeElement.id)}
                                    className="w-full py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition"
                                >
                                    <Trash2 size={14} /> Delete Element
                                </button>
                            </div>

                            <hr className="border-gray-100" />
                            <div className="text-center">
                                <button
                                    onClick={() => { setSelectedElementId(null); setEditingId(null); }}
                                    className="text-xs text-indigo-500 hover:text-indigo-700 underline"
                                >
                                    Back to Canvas Settings
                                </button>
                            </div>

                        </div>
                    ) : (
                        <div className="p-5 space-y-6">
                            <div>
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Canvas Settings</h3>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-3">
                                        <InputGroup
                                            label="Width (px)"
                                            value={canvasSize.width}
                                            onChange={v => setCanvasSize(prev => ({ ...prev, width: Number(v) }))}
                                            type="number"
                                        />
                                        <InputGroup
                                            label="Height (px)"
                                            value={canvasSize.height}
                                            onChange={v => setCanvasSize(prev => ({ ...prev, height: Number(v) }))}
                                            type="number"
                                        />
                                    </div>

                                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-xs text-blue-700">
                                        <p className="font-semibold mb-2">Standard Sizes:</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            {paperSizes.map(size => (
                                                <React.Fragment key={size.name}>
                                                    <button
                                                        onClick={() => setCanvasSize({ width: size.width, height: size.height })}
                                                        className="bg-white border text-blue-600 px-2 py-1 rounded shadow-sm hover:bg-blue-50 text-center"
                                                    >
                                                        {size.name} (P)
                                                    </button>
                                                    <button
                                                        onClick={() => setCanvasSize({ width: size.height, height: size.width })}
                                                        className="bg-white border text-blue-600 px-2 py-1 rounded shadow-sm hover:bg-blue-50 text-center"
                                                    >
                                                        {size.name} (L)
                                                    </button>
                                                </React.Fragment>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <hr className="border-gray-100" />

                            <div className="flex flex-col items-center justify-center py-10 text-gray-400 text-center opacity-60">
                                <MousePointer size={32} className="mb-3" />
                                <p className="text-sm">Select an element to edit properties</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            {/* Hidden File Input */}
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleImageUpload}
            />
        </div>
    );
};

const ToolButton = ({ icon, label, onClick }) => (
    <button onClick={onClick} className="flex flex-col items-center justify-center p-2 hover:bg-white hover:shadow-sm rounded transition w-14 text-gray-600 hover:text-indigo-600 shrink-0">
        {icon}
        <span className="text-[9px] mt-1 font-medium text-center leading-tight">{label}</span>
    </button>
);

const InputGroup = ({ label, value, onChange, type = "text" }) => (
    <div>
        <label className="text-[10px] text-gray-500 font-medium block truncate-ellipsis">{label}</label>
        <div className="flex items-center mt-1 relative">
            {type === 'color' && (
                <div
                    className="w-6 h-6 rounded border mr-2 shadow-sm shrink-0"
                    style={{ backgroundColor: value }}
                ></div>
            )}
            <input
                type={type}
                className={`w-full border rounded p-1.5 text-xs bg-gray-50 focus:bg-white focus:ring-2 ring-indigo-100 outline-none transition ${type === 'color' ? 'opacity-0 absolute w-8 h-8 cursor-pointer' : ''}`}
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
        </div>
    </div>
);

export default CertificateDesigner;
