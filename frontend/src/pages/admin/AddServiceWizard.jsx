import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import { Mention, MentionsInput } from "react-mentions";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  Eye,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Type,
  Space,
} from "lucide-react";
import { serviceService } from "../../services/serviceService";
import { certificateTemplateService } from "../../services/certificateTemplateService";
import CertificateDesigner from "./CertificateDesigner";
import api from "../../config/api";

const AddServiceWizard = () => {
  const navigate = useNavigate();
  const { id: editServiceId } = useParams(); // For edit mode
  const [currentStep, setCurrentStep] = useState(1);
  const [colleges, setColleges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Consolidated State
  const [serviceData, setServiceData] = useState({
    name: "",
    description: "",
    price: "",
    college_id: "",
    is_active: true,
  });

  const [templateData, setTemplateData] = useState({
    top_content: "",
    middle_content: "",
    bottom_content: "",
    top_alignment: "center",
    middle_alignment: "center",
    bottom_alignment: "center",
    padding_left: 40,
    padding_right: 40,
    padding_top: 40,
    padding_bottom: 40,
    top_section_padding: 10,
    middle_section_padding: 20,
    bottom_section_padding: 10,
    header_height: 80,
    footer_height: 60,
    font_size: 12,
    line_spacing: 2,
    top_spacing: 15,
    middle_spacing: 15,
    bottom_spacing: 15,
    blank_variables: [],
    page_size: "A4",
    page_orientation: "portrait",
  });

  // Preview state for final review
  const [finalPreviewJson, setFinalPreviewJson] = useState(null);

  // Available variables for autocomplete
  const [variables, setVariables] = useState([]);

  // Fetch variables on mount
  useEffect(() => {
    const fetchVariables = async () => {
      try {
        const response = await certificateTemplateService.getVariables();
        setVariables(response.data.systemVariables || []);
      } catch (error) {
        console.error("Error fetching variables:", error);
      }
    };
    fetchVariables();
  }, []);

  useEffect(() => {
    const initializeData = async () => {
      await fetchColleges();
      if (editServiceId) {
        setIsEditing(true);
        await fetchServiceDetails(editServiceId);
      }
      setDataLoaded(true);
    };
    initializeData();
  }, [editServiceId]);

  useEffect(() => {
    if (currentStep === 3) {
      generatePreview();
    }
  }, [currentStep]);

  const fetchColleges = async () => {
    try {
      const response = await api.get("/colleges");
      const collegeData = response.data.data || [];
      setColleges(collegeData);
      return collegeData;
    } catch (error) {
      console.error(error);
      toast.error("Failed to load colleges");
      return [];
    }
  };

  const fetchServiceDetails = async (id) => {
    try {
      setLoading(true);

      // Fetch all services and find the one we need (backend doesn't have GET /services/:id)
      const servicesResponse = await serviceService.getAllServices();
      const service = servicesResponse.data.find((s) => s.id == id);

      if (!service) {
        toast.error("Service not found");
        navigate("/services/config");
        return;
      }

      setServiceData({
        name: service.name,
        description: service.description || "",
        price: service.price,
        college_id: "", // Will be set from template
        is_active: !!service.is_active,
      });

      // Fetch template to get college_id
      const templatesRes = await certificateTemplateService.getTemplates({
        service_id: id,
      });

      if (templatesRes.data && templatesRes.data.length > 0) {
        const template = templatesRes.data[0];
        const templateCollegeId = template.college_id
          ? String(template.college_id)
          : "";

        // Update serviceData with college_id from template
        setServiceData((prev) => ({
          ...prev,
          college_id: templateCollegeId,
        }));

        setTemplateData({
          top_content: template.top_content || "",
          middle_content: template.middle_content || "",
          bottom_content: template.bottom_content || "",
          padding_left: template.padding_left || 40,
          padding_right: template.padding_right || 40,
          padding_top: template.padding_top || 40,
          padding_bottom: template.padding_bottom || 40,
          header_height: template.header_height || 80,
          footer_height: template.footer_height || 60,
          font_size: template.font_size || 12,
          line_spacing: template.line_spacing || 2,
          blank_variables: template.blank_variables || [],
          page_size: template.page_size || "A4",
          page_orientation: template.page_orientation || "portrait",
          college_id: templateCollegeId,
        });
      }
    } catch (error) {
      console.error("Error fetching details:", error);
      toast.error("Failed to load service details");
    } finally {
      setLoading(false);
    }
  };

  const handleStep1Submit = () => {
    if (!serviceData.name || !serviceData.price || !serviceData.college_id) {
      toast.error("Please fill all required fields");
      return;
    }
    // In wizard, just move to next step, don't save yet
    setTemplateData((prev) => ({
      ...prev,
      college_id: serviceData.college_id,
    }));
    setCurrentStep(2);
  };

  const handleStep2Submit = () => {
    // Validation for Step 2
    if (!templateData.middle_content) {
      toast.error("Middle section content is required");
      return;
    }
    // Skip to step 3 (final review) directly
    setCurrentStep(3);
    generatePreview();
  };

  const generatePreview = async () => {
    // Logic to prepare preview URL for final review
    try {
      const blob = await serviceService.previewTemplate({
        template_type: "dynamic",
        service_name: serviceData.name,
        template_config: {
          ...templateData,
          // If URLs are needed, they are in templateData or resolved by backend
        },
      });
      const url = URL.createObjectURL(blob);
      setFinalPreviewJson(url);
    } catch (e) {
      console.error(e);
    }
  };

  const handleFinalSubmit = async () => {
    try {
      setLoading(true);
      const toastId = toast.loading(
        isEditing ? "Updating service..." : "Creating service...",
      );

      let serviceId = editServiceId;

      // 1. Create/Update Service (without college_id - that's stored in template)
      const servicePayload = {
        name: serviceData.name,
        description: serviceData.description,
        price: serviceData.price,
        is_active: serviceData.is_active,
        template_type: "dynamic",
        template_config: templateData,
      };

      if (isEditing) {
        await serviceService.updateService(serviceId, servicePayload);
      } else {
        const serviceResponse =
          await serviceService.createService(servicePayload);
        serviceId =
          serviceResponse.serviceId ||
          serviceResponse.data?.id ||
          serviceResponse.id;
      }

      if (!serviceId) throw new Error("Failed to get Service ID");

      // 2. Create/Update Template (college_id is stored here)
      const templatesRes = await certificateTemplateService.getTemplates({
        service_id: serviceId,
      });
      const existingTemplate =
        templatesRes.data && templatesRes.data.length > 0
          ? templatesRes.data[0]
          : null;

      const finalTemplateData = {
        ...templateData,
        service_id: serviceId,
        college_id: serviceData.college_id, // Store college_id in template table
      };

      if (existingTemplate) {
        await certificateTemplateService.updateTemplate(
          existingTemplate.id,
          finalTemplateData,
        );
      } else {
        await certificateTemplateService.createTemplate(finalTemplateData);
      }

      toast.dismiss(toastId);
      toast.success(
        `Service ${isEditing ? "updated" : "created"} successfully!`,
      );
      navigate("/services/config");
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || "Failed to save service");
    } finally {
      setLoading(false);
    }
  };

  const renderStepIndicator = () => {
    const steps = [
      { num: 1, label: "Service Info" },
      { num: 2, label: "Certificate Content" },
      { num: 3, label: "Review & Save" },
    ];

    return (
      <div className="flex items-center justify-center mb-8">
        {steps.map((step, index) => (
          <React.Fragment key={step.num}>
            <div className="flex flex-col items-center">
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition ${
                  currentStep >= step.num
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "bg-white border-gray-300 text-gray-400"
                }`}
              >
                {currentStep > step.num ? <Check size={20} /> : index + 1}
              </div>
              <span className="text-xs mt-1 text-gray-600">{step.label}</span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`w-16 h-1 transition mb-6 ${
                  currentStep > step.num ? "bg-blue-600" : "bg-gray-300"
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };

  const renderStep1 = () => {
    if (isEditing && !dataLoaded) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading service details...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center justify-center gap-2">
            <FileText size={28} className="text-blue-600" />
            Service Details
          </h2>
          <p className="text-gray-500 mt-2">
            Enter basic information about the service
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Service Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={serviceData.name}
              onChange={(e) =>
                setServiceData({ ...serviceData, name: e.target.value })
              }
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="e.g., Transfer Certificate"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select College <span className="text-red-500">*</span>
            </label>
            <select
              value={serviceData.college_id || ""}
              onChange={(e) =>
                setServiceData({ ...serviceData, college_id: e.target.value })
              }
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">-- Choose a college --</option>
              {colleges.map((college) => {
                const optionValue = String(college.id);
                return (
                  <option key={college.id} value={optionValue}>
                    {college.name}
                  </option>
                );
              })}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              The certificate will use this college's header and footer images
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Price (₹) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={serviceData.price}
              onChange={(e) =>
                setServiceData({ ...serviceData, price: e.target.value })
              }
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="e.g., 100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={serviceData.description}
              onChange={(e) =>
                setServiceData({ ...serviceData, description: e.target.value })
              }
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              rows="3"
              placeholder="Brief description of the service"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={serviceData.is_active}
              onChange={(e) =>
                setServiceData({ ...serviceData, is_active: e.target.checked })
              }
              className="w-4 h-4 text-blue-600 rounded"
            />
            <label htmlFor="is_active" className="text-sm text-gray-700">
              Active (Available to students)
            </label>
          </div>
        </div>

        <div className="flex justify-between">
          <button
            onClick={() => navigate("/services/config")}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <ArrowLeft size={18} /> Cancel
          </button>
          <button
            onClick={handleStep1Submit}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
          >
            Next: Certificate Content <ArrowRight size={18} />
          </button>
        </div>
      </div>
    );
  };

  const renderStep2 = () => {
    // Get college header/footer images
    const selectedCollege = colleges.find(
      (c) => c.id === serviceData.college_id,
    );
    const baseURL = (
      api.defaults?.baseURL || "http://localhost:5000/api"
    ).replace(/\/api$/, "");

    const getImageUrl = (url) => {
      if (!url) return null;
      return url.startsWith("http")
        ? url
        : `${baseURL}${url.startsWith("/") ? "" : "/"}${url}`;
    };

    const headerImageUrl = selectedCollege?.header_image_url
      ? getImageUrl(selectedCollege.header_image_url)
      : null;
    const footerImageUrl = selectedCollege?.footer_image_url
      ? getImageUrl(selectedCollege.footer_image_url)
      : null;

    // Format variables for react-mentions
    const mentionData = variables.map((v) => ({
      id: v.name,
      display: `@${v.name}`,
    }));

    // Mention style for autocomplete with whitespace preservation
    const getMentionStyle = (alignment = "center") => ({
      control: {
        backgroundColor: "#fff",
        fontSize: 14,
        fontFamily: "inherit",
        minHeight: 80,
        border: "1px solid #d1d5db",
        borderRadius: "0.5rem",
        padding: "0.5rem",
        textAlign: alignment,
        whiteSpace: "pre-wrap", // Preserve spaces and line breaks
      },
      highlighter: {
        overflow: "hidden",
        padding: "0.5rem",
        textAlign: alignment,
        whiteSpace: "pre-wrap", // Preserve spaces and line breaks
      },
      input: {
        margin: 0,
        padding: 0,
        border: 0,
        outline: 0,
        textAlign: alignment,
        whiteSpace: "pre-wrap", // Preserve spaces and line breaks
      },
      suggestions: {
        list: {
          backgroundColor: "white",
          border: "1px solid #e5e7eb",
          borderRadius: "0.5rem",
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
          maxHeight: 200,
          overflow: "auto",
          zIndex: 1000,
        },
        item: {
          padding: "8px 12px",
          borderBottom: "1px solid #f3f4f6",
          "&focused": {
            backgroundColor: "#eff6ff",
          },
        },
      },
    });

    // Process content to show input fields for ___ and replace @ variables
    const processContentForPreview = (content, alignment = "center") => {
      if (!content) return "";

      // Escape HTML but preserve spaces and line breaks
      let processed = content
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/ /g, "&nbsp;") // Preserve spaces
        .replace(/\n/g, "<br/>"); // Preserve line breaks

      // Replace @variable with styled variable (after HTML escaping)
      processed = processed.replace(/@(\w+)/g, (match, varName) => {
        return `<span class="inline-block bg-green-100 text-green-800 px-2 py-0.5 rounded text-sm font-mono">${match}</span>`;
      });

      // Replace ___ with styled input field placeholder
      processed = processed.replace(
        /___/g,
        '<span class="inline-block border-b-2 border-blue-400 px-8 py-1 mx-1 bg-blue-50">[Input Field]</span>',
      );

      return <div dangerouslySetInnerHTML={{ __html: processed }} />;
    };

    return (
      <div
        className="fixed top-0 left-0 right-0 bottom-0 flex flex-col bg-white overflow-hidden"
        style={{ marginLeft: "240px", zIndex: 50 }}
      >
        {/* Top Bar for Step 2 Context */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Step 2: Certificate Content
            </h2>
            <p className="text-xs text-gray-500">
              Type ___ (three underscores) to create input fields
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setCurrentStep(1)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2 text-sm"
            >
              <ArrowLeft size={16} /> Back
            </button>
            <button
              onClick={handleStep2Submit}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm"
            >
              Save & Preview <Check size={16} />
            </button>
          </div>
        </div>

        {/* Split View: Input Fields + Live Preview */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Side: Input Fields and Controls */}
          <div className="w-1/2 overflow-y-auto bg-gray-50 p-6 border-r wizard-sidebar-scroll">
            <div className="max-w-2xl mx-auto space-y-4">
              {/* Top Section Input */}
              <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-gray-900">
                    Top Section (Optional)
                  </label>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setTemplateData({
                          ...templateData,
                          top_alignment: "left",
                        })
                      }
                      className={`p-1.5 rounded ${templateData.top_alignment === "left" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"}`}
                      title="Align Left"
                    >
                      <AlignLeft size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setTemplateData({
                          ...templateData,
                          top_alignment: "center",
                        })
                      }
                      className={`p-1.5 rounded ${templateData.top_alignment === "center" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"}`}
                      title="Align Center"
                    >
                      <AlignCenter size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setTemplateData({
                          ...templateData,
                          top_alignment: "right",
                        })
                      }
                      className={`p-1.5 rounded ${templateData.top_alignment === "right" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"}`}
                      title="Align Right"
                    >
                      <AlignRight size={12} />
                    </button>
                  </div>
                </div>
                <MentionsInput
                  value={templateData.top_content}
                  onChange={(e) =>
                    setTemplateData({
                      ...templateData,
                      top_content: e.target.value,
                    })
                  }
                  style={getMentionStyle(
                    templateData.top_alignment || "center",
                  )}
                  placeholder="Type @ to see variables, ___ for input fields"
                >
                  <Mention
                    trigger="@"
                    data={mentionData}
                    style={{ backgroundColor: "#dbeafe" }}
                  />
                </MentionsInput>
              </div>

              {/* Middle Section Input */}
              <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-gray-900">
                    Middle Section (Required) *
                  </label>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setTemplateData({
                          ...templateData,
                          middle_alignment: "left",
                        })
                      }
                      className={`p-1.5 rounded ${templateData.middle_alignment === "left" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"}`}
                      title="Align Left"
                    >
                      <AlignLeft size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setTemplateData({
                          ...templateData,
                          middle_alignment: "center",
                        })
                      }
                      className={`p-1.5 rounded ${templateData.middle_alignment === "center" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"}`}
                      title="Align Center"
                    >
                      <AlignCenter size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setTemplateData({
                          ...templateData,
                          middle_alignment: "right",
                        })
                      }
                      className={`p-1.5 rounded ${templateData.middle_alignment === "right" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"}`}
                      title="Align Right"
                    >
                      <AlignRight size={12} />
                    </button>
                  </div>
                </div>
                <MentionsInput
                  value={templateData.middle_content}
                  onChange={(e) =>
                    setTemplateData({
                      ...templateData,
                      middle_content: e.target.value,
                    })
                  }
                  style={{
                    ...getMentionStyle(
                      templateData.middle_alignment || "center",
                    ),
                    control: {
                      ...getMentionStyle(
                        templateData.middle_alignment || "center",
                      ).control,
                      minHeight: 150,
                    },
                  }}
                  placeholder="Type @ to see variables, ___ for input fields"
                >
                  <Mention
                    trigger="@"
                    data={mentionData}
                    style={{ backgroundColor: "#dbeafe" }}
                  />
                </MentionsInput>
              </div>

              {/* Bottom Section Input */}
              <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-gray-900">
                    Bottom Section (Optional)
                  </label>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setTemplateData({
                          ...templateData,
                          bottom_alignment: "left",
                        })
                      }
                      className={`p-1.5 rounded ${templateData.bottom_alignment === "left" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"}`}
                      title="Align Left"
                    >
                      <AlignLeft size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setTemplateData({
                          ...templateData,
                          bottom_alignment: "center",
                        })
                      }
                      className={`p-1.5 rounded ${templateData.bottom_alignment === "center" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"}`}
                      title="Align Center"
                    >
                      <AlignCenter size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setTemplateData({
                          ...templateData,
                          bottom_alignment: "right",
                        })
                      }
                      className={`p-1.5 rounded ${templateData.bottom_alignment === "right" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"}`}
                      title="Align Right"
                    >
                      <AlignRight size={12} />
                    </button>
                  </div>
                </div>
                <MentionsInput
                  value={templateData.bottom_content}
                  onChange={(e) =>
                    setTemplateData({
                      ...templateData,
                      bottom_content: e.target.value,
                    })
                  }
                  style={getMentionStyle(
                    templateData.bottom_alignment || "center",
                  )}
                  placeholder="Type @ to see variables, ___ for input fields"
                >
                  <Mention
                    trigger="@"
                    data={mentionData}
                    style={{ backgroundColor: "#dbeafe" }}
                  />
                </MentionsInput>
              </div>

              {/* Typography Controls */}
              <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200">
                <h4 className="text-xs font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Type size={14} /> Typography
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-medium text-gray-600 mb-1">
                      Font Size (px)
                    </label>
                    <input
                      type="number"
                      min="8"
                      max="24"
                      value={templateData.font_size || 12}
                      onChange={(e) =>
                        setTemplateData({
                          ...templateData,
                          font_size: parseInt(e.target.value) || 12,
                        })
                      }
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-600 mb-1">
                      Line Spacing
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="3"
                      step="0.1"
                      value={templateData.line_spacing || 1.5}
                      onChange={(e) =>
                        setTemplateData({
                          ...templateData,
                          line_spacing: parseFloat(e.target.value) || 1.5,
                        })
                      }
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Section Padding Controls */}
              <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200">
                <h4 className="text-xs font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Space size={14} /> Section Spacing (px)
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-medium text-gray-600 mb-1">
                      Top
                    </label>
                    <input
                      type="number"
                      value={templateData.top_section_padding || 10}
                      onChange={(e) =>
                        setTemplateData({
                          ...templateData,
                          top_section_padding: parseInt(e.target.value) || 10,
                        })
                      }
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-600 mb-1">
                      Middle
                    </label>
                    <input
                      type="number"
                      value={templateData.middle_section_padding || 20}
                      onChange={(e) =>
                        setTemplateData({
                          ...templateData,
                          middle_section_padding:
                            parseInt(e.target.value) || 20,
                        })
                      }
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-600 mb-1">
                      Bottom
                    </label>
                    <input
                      type="number"
                      value={templateData.bottom_section_padding || 10}
                      onChange={(e) =>
                        setTemplateData({
                          ...templateData,
                          bottom_section_padding:
                            parseInt(e.target.value) || 10,
                        })
                      }
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Page Padding Controls */}
              <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200">
                <h4 className="text-xs font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Space size={14} /> Page Margins (px)
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-medium text-gray-600 mb-1">
                      Left
                    </label>
                    <input
                      type="number"
                      value={templateData.padding_left || 40}
                      onChange={(e) =>
                        setTemplateData({
                          ...templateData,
                          padding_left: parseInt(e.target.value) || 40,
                        })
                      }
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-600 mb-1">
                      Right
                    </label>
                    <input
                      type="number"
                      value={templateData.padding_right || 40}
                      onChange={(e) =>
                        setTemplateData({
                          ...templateData,
                          padding_right: parseInt(e.target.value) || 40,
                        })
                      }
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-600 mb-1">
                      Top
                    </label>
                    <input
                      type="number"
                      value={templateData.padding_top || 40}
                      onChange={(e) =>
                        setTemplateData({
                          ...templateData,
                          padding_top: parseInt(e.target.value) || 40,
                        })
                      }
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-600 mb-1">
                      Bottom
                    </label>
                    <input
                      type="number"
                      value={templateData.padding_bottom || 40}
                      onChange={(e) =>
                        setTemplateData({
                          ...templateData,
                          padding_bottom: parseInt(e.target.value) || 40,
                        })
                      }
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Header/Footer Size Controls */}
              <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200">
                <h4 className="text-xs font-semibold text-gray-900 mb-3">
                  Header & Footer Size (px)
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-medium text-gray-600 mb-1">
                      Header Height
                    </label>
                    <input
                      type="number"
                      value={templateData.header_height || 80}
                      onChange={(e) =>
                        setTemplateData({
                          ...templateData,
                          header_height: parseInt(e.target.value) || 80,
                        })
                      }
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-600 mb-1">
                      Footer Height
                    </label>
                    <input
                      type="number"
                      value={templateData.footer_height || 60}
                      onChange={(e) =>
                        setTemplateData({
                          ...templateData,
                          footer_height: parseInt(e.target.value) || 60,
                        })
                      }
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Help Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <h4 className="text-xs font-semibold text-blue-900 mb-2">
                  💡 Quick Tips
                </h4>
                <ul className="text-[10px] text-blue-800 space-y-1">
                  <li>• Type @ to see autocomplete with variables</li>
                  <li>• Type ___ (3 underscores) for input fields</li>
                  <li>• Adjust margins, spacing, and fonts</li>
                  <li>• Preview updates in real-time</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Right Side: Live Preview with Applied Styling */}
          <div className="w-1/2 bg-gray-200 p-6 overflow-y-auto">
            <div className="max-w-4xl mx-auto">
              <div className="bg-white rounded-lg shadow-2xl overflow-hidden">
                {/* Certificate Preview */}
                <div
                  className="relative"
                  style={{
                    minHeight: "800px",
                    paddingLeft: `${templateData.padding_left || 40}px`,
                    paddingRight: `${templateData.padding_right || 40}px`,
                    paddingTop: `${templateData.padding_top || 40}px`,
                    paddingBottom: `${templateData.padding_bottom || 40}px`,
                    fontSize: `${templateData.font_size || 12}px`,
                    lineHeight: templateData.line_spacing || 1.5,
                  }}
                >
                  {/* Header Image */}
                  {headerImageUrl && (
                    <div
                      className="mb-4"
                      style={{
                        height: `${templateData.header_height || 80}px`,
                      }}
                    >
                      <img
                        src={headerImageUrl}
                        alt="Header"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  )}

                  {/* Top Content */}
                  {templateData.top_content && (
                    <div
                      className="text-gray-800"
                      style={{
                        textAlign: templateData.top_alignment || "center",
                        paddingBottom: `${templateData.top_section_padding || 10}px`,
                      }}
                    >
                      <div className="whitespace-pre-wrap">
                        {processContentForPreview(
                          templateData.top_content,
                          templateData.top_alignment,
                        )}
                      </div>
                    </div>
                  )}

                  {/* Middle Content */}
                  {templateData.middle_content && (
                    <div
                      className="text-gray-800"
                      style={{
                        textAlign: templateData.middle_alignment || "center",
                        paddingTop: `${templateData.middle_section_padding || 20}px`,
                        paddingBottom: `${templateData.middle_section_padding || 20}px`,
                      }}
                    >
                      <div className="whitespace-pre-wrap">
                        {processContentForPreview(
                          templateData.middle_content,
                          templateData.middle_alignment,
                        )}
                      </div>
                    </div>
                  )}

                  {/* Bottom Content */}
                  {templateData.bottom_content && (
                    <div
                      className="text-gray-800"
                      style={{
                        textAlign: templateData.bottom_alignment || "center",
                        paddingTop: `${templateData.bottom_section_padding || 10}px`,
                      }}
                    >
                      <div className="whitespace-pre-wrap">
                        {processContentForPreview(
                          templateData.bottom_content,
                          templateData.bottom_alignment,
                        )}
                      </div>
                    </div>
                  )}

                  {/* Footer Image */}
                  {footerImageUrl && (
                    <div
                      className="mt-4"
                      style={{
                        height: `${templateData.footer_height || 60}px`,
                      }}
                    >
                      <img
                        src={footerImageUrl}
                        alt="Footer"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  )}

                  {/* Preview Badge */}
                  <div className="absolute top-4 right-4 bg-green-100 text-green-800 text-xs font-bold px-3 py-1 rounded-full border border-green-200 shadow-sm uppercase tracking-wider">
                    LIVE PREVIEW
                  </div>

                  {/* Placeholder when empty */}
                  {!templateData.middle_content && (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                      <div className="text-center">
                        <FileText
                          size={48}
                          className="mx-auto mb-2 opacity-50"
                        />
                        <p className="text-sm">Start typing to see preview</p>
                        <p className="text-xs mt-2">Type @ to add variables</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderStep3 = () => (
    <div className="space-y-8 max-w-6xl mx-auto py-6">
      <div className="text-center mb-8">
        <h2 className="text-4xl font-bold text-gray-900 flex items-center justify-center gap-4 mb-3">
          <Eye size={40} className="text-green-600" />
          Final Review
        </h2>
        <p className="text-gray-600 text-lg">
          Review your certificate configuration before publishing
        </p>
        <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-full text-sm text-blue-700 font-medium">
          <Check size={16} />
          All settings configured successfully
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-gradient-to-br from-white to-blue-50 p-6 rounded-2xl shadow-lg border-2 border-blue-100">
            <h3 className="text-xl font-bold mb-4 border-b-2 border-blue-200 pb-3 text-blue-900">
              📋 Service Details
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase">
                  Service Name
                </label>
                <p className="font-semibold text-gray-900">
                  {serviceData.name}
                </p>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase">
                  College
                </label>
                <p className="font-semibold text-gray-900 border-l-2 border-blue-500 pl-2">
                  {colleges.find((c) => c.id == serviceData.college_id)?.name}
                </p>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase">
                  Price
                </label>
                <p className="text-xl font-bold text-blue-600">
                  ₹{serviceData.price}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-white to-green-50 p-6 rounded-2xl shadow-lg border-2 border-green-100">
            <h3 className="text-xl font-bold mb-4 border-b-2 border-green-200 pb-3 text-green-900">
              ⚙️ Layout Settings
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <label className="text-gray-400 block">Font Size</label>
                <span className="font-medium">{templateData.font_size}px</span>
              </div>
              <div>
                <label className="text-gray-400 block">Spacing</label>
                <span className="font-medium">{templateData.line_spacing}</span>
              </div>
              <div>
                <label className="text-gray-400 block">Orientation</label>
                <span className="font-medium capitalize">
                  {templateData.page_orientation}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white p-4 rounded-2xl shadow-2xl border-2 border-gray-300 aspect-[1/1.414] overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b-2 border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50 flex justify-between items-center rounded-t-xl">
              <span className="text-base font-bold text-gray-800 flex items-center gap-2">
                <Eye size={20} />
                Certificate Preview
              </span>
              <button
                onClick={generatePreview}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-bold uppercase transition-all hover:shadow-md flex items-center gap-1"
              >
                <ArrowRight size={14} />
                Refresh
              </button>
            </div>
            <div className="flex-1 bg-gray-200 rounded-b-xl overflow-hidden">
              {finalPreviewJson ? (
                <iframe
                  src={finalPreviewJson}
                  className="w-full h-full bg-white"
                  title="Final Step Preview"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-gray-500 flex-col gap-3">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600"></div>
                  <p className="font-semibold">Generating Preview...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center bg-gradient-to-r from-blue-50 to-green-50 p-6 rounded-2xl border-2 border-blue-200 shadow-lg mt-8">
        <button
          onClick={() => setCurrentStep(2)}
          className="px-6 py-3 border-2 border-gray-300 rounded-xl hover:bg-white hover:shadow-md flex items-center gap-2 font-semibold transition-all"
        >
          <ArrowLeft size={20} /> Back to Edit
        </button>
        <button
          onClick={handleFinalSubmit}
          disabled={loading}
          className="px-12 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 flex items-center gap-3 text-lg font-bold shadow-lg shadow-blue-200 disabled:opacity-50 transition-all hover:scale-[1.02]"
        >
          <Check size={24} /> Confirm & Publish Service
        </button>
      </div>
    </div>
  );

  return (
    <div
      className={
        currentStep === 2
          ? ""
          : "p-6 max-w-4xl mx-auto space-y-6 animate-fade-in"
      }
    >
      {/* Header - Hide on Step 2 */}
      {currentStep !== 2 && (
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate("/services/config")}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isEditing ? "Edit Service" : "Add New Service"}
            </h1>
            <p className="text-gray-500">Step {currentStep} of 3</p>
          </div>
        </div>
      )}

      {/* Step Indicator - Hide on Step 2 */}
      {currentStep !== 2 && renderStepIndicator()}

      {/* Step Content */}
      {currentStep === 1 && renderStep1()}
      {currentStep === 2 && renderStep2()}
      {currentStep === 3 && renderStep3()}
    </div>
  );
};

export default AddServiceWizard;
