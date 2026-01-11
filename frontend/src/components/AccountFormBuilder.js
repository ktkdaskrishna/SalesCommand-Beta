import React, { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import api from "../services/api";
import { cn } from "../lib/utils";
import { toast } from "sonner";
import ExpandableContainer from "./ExpandableContainer";
import {
  GripVertical,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  Eye,
  EyeOff,
  Settings,
  Type,
  Hash,
  Calendar,
  DollarSign,
  List,
  Mail,
  Phone,
  Globe,
  FileText,
  Users,
  ToggleLeft,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Loader2,
  Columns,
  PanelLeft,
  Layers,
} from "lucide-react";

// Field type configuration
const FIELD_TYPES = {
  text: { icon: Type, label: "Text", color: "bg-blue-500" },
  textarea: { icon: FileText, label: "Text Area", color: "bg-blue-600" },
  number: { icon: Hash, label: "Number", color: "bg-green-500" },
  currency: { icon: DollarSign, label: "Currency", color: "bg-emerald-500" },
  date: { icon: Calendar, label: "Date", color: "bg-purple-500" },
  dropdown: { icon: List, label: "Dropdown", color: "bg-amber-500" },
  email: { icon: Mail, label: "Email", color: "bg-rose-500" },
  phone: { icon: Phone, label: "Phone", color: "bg-pink-500" },
  url: { icon: Globe, label: "URL", color: "bg-indigo-500" },
  checkbox: { icon: ToggleLeft, label: "Checkbox", color: "bg-slate-500" },
  relationship: { icon: Users, label: "User Link", color: "bg-violet-500" },
  computed: { icon: Sparkles, label: "Computed", color: "bg-yellow-500" },
};

const AccountFormBuilder = ({ onClose }) => {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeView, setActiveView] = useState("builder"); // "builder" or "preview"
  const [editingField, setEditingField] = useState(null);
  const [editingSection, setEditingSection] = useState(null);
  const [showNewField, setShowNewField] = useState(false);
  const [showNewSection, setShowNewSection] = useState(false);
  const [expandedSections, setExpandedSections] = useState({});

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await api.get("/config/account-fields");
      setConfig(response.data);
      // Expand all sections by default
      const expanded = {};
      response.data?.layout?.sections?.forEach(s => expanded[s.id] = true);
      setExpandedSections(expanded);
    } catch (error) {
      toast.error("Failed to load configuration");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put("/config/account-fields", config);
      toast.success("Form configuration saved!");
    } catch (error) {
      toast.error("Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const { source, destination, type } = result;

    if (type === "section") {
      // Reorder sections
      const sections = [...(config.layout?.sections || [])];
      const [removed] = sections.splice(source.index, 1);
      sections.splice(destination.index, 0, removed);
      // Update order numbers
      sections.forEach((s, idx) => s.order = idx + 1);
      setConfig({ ...config, layout: { ...config.layout, sections } });
    } else if (type === "field") {
      // Moving fields between sections or within same section
      const sourceSectionId = source.droppableId.replace("section-", "");
      const destSectionId = destination.droppableId.replace("section-", "");

      if (sourceSectionId === "palette") {
        // Dragging from palette - this is adding a new field
        // The palette shows available field types, not actual fields
        return;
      }

      // Get the field being moved
      const fields = [...(config.fields || [])];
      const fieldIndex = fields.findIndex(f => f.section_id === sourceSectionId && 
        fields.filter(ff => ff.section_id === sourceSectionId).indexOf(f) === source.index);
      
      if (fieldIndex === -1) return;

      // Update field's section
      fields[fieldIndex].section_id = destSectionId;

      // Reorder fields within destination section
      const destFields = fields.filter(f => f.section_id === destSectionId);
      destFields.forEach((f, idx) => f.order = idx + 1);

      setConfig({ ...config, fields });
    }
  };

  const addSection = (sectionData) => {
    const sections = [...(config.layout?.sections || [])];
    const newSection = {
      id: sectionData.name.toLowerCase().replace(/\s+/g, "_"),
      name: sectionData.name,
      icon: sectionData.icon || "📋",
      columns: sectionData.columns || 2,
      order: sections.length + 1,
      collapsed_by_default: false,
    };
    sections.push(newSection);
    setConfig({ ...config, layout: { ...config.layout, sections } });
    setExpandedSections({ ...expandedSections, [newSection.id]: true });
    setShowNewSection(false);
    toast.success("Section added");
  };

  const updateSection = (sectionId, updates) => {
    const sections = config.layout?.sections?.map(s => 
      s.id === sectionId ? { ...s, ...updates } : s
    ) || [];
    setConfig({ ...config, layout: { ...config.layout, sections } });
    setEditingSection(null);
    toast.success("Section updated");
  };

  const deleteSection = (sectionId) => {
    if (!window.confirm("Delete this section? Fields will become unassigned.")) return;
    const sections = config.layout?.sections?.filter(s => s.id !== sectionId) || [];
    // Unassign fields from deleted section
    const fields = config.fields?.map(f => 
      f.section_id === sectionId ? { ...f, section_id: null } : f
    ) || [];
    setConfig({ ...config, layout: { ...config.layout, sections }, fields });
    toast.success("Section deleted");
  };

  const addField = (fieldData) => {
    const fields = [...(config.fields || [])];
    const newField = {
      id: fieldData.name.toLowerCase().replace(/\s+/g, "_"),
      name: fieldData.name,
      field_type: fieldData.field_type,
      section_id: fieldData.section_id || null,
      description: fieldData.description || "",
      placeholder: fieldData.placeholder || "",
      validation: { required: fieldData.required || false },
      visible: true,
      editable: true,
      show_in_list: fieldData.show_in_list || false,
      show_in_card: fieldData.show_in_card || false,
      options: fieldData.options || [],
      order: fields.filter(f => f.section_id === fieldData.section_id).length + 1,
      is_system: false,
    };
    fields.push(newField);
    setConfig({ ...config, fields });
    setShowNewField(false);
    toast.success("Field added");
  };

  const updateField = (fieldId, updates) => {
    const fields = config.fields?.map(f => 
      f.id === fieldId ? { ...f, ...updates } : f
    ) || [];
    setConfig({ ...config, fields });
    setEditingField(null);
    toast.success("Field updated");
  };

  const deleteField = (fieldId) => {
    const field = config.fields?.find(f => f.id === fieldId);
    if (field?.is_system) {
      toast.error("Cannot delete system fields");
      return;
    }
    if (!window.confirm("Delete this field?")) return;
    const fields = config.fields?.filter(f => f.id !== fieldId) || [];
    setConfig({ ...config, fields });
    toast.success("Field deleted");
  };

  const toggleSectionExpand = (sectionId) => {
    setExpandedSections({ ...expandedSections, [sectionId]: !expandedSections[sectionId] });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const sections = config?.layout?.sections || [];
  const fields = config?.fields || [];
  const unassignedFields = fields.filter(f => !f.section_id || !sections.find(s => s.id === f.section_id));

  return (
    <ExpandableContainer
      title="Account Form Builder"
      subtitle="Drag and drop to customize account fields and layout"
      icon={Layers}
      headerActions={
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setActiveView("builder")}
              className={cn("px-3 py-1.5 text-sm rounded-md flex items-center gap-2", 
                activeView === "builder" ? "bg-white shadow text-slate-900" : "text-slate-500")}
            >
              <Settings className="w-4 h-4" /> Builder
            </button>
            <button
              onClick={() => setActiveView("preview")}
              className={cn("px-3 py-1.5 text-sm rounded-md flex items-center gap-2",
                activeView === "preview" ? "bg-white shadow text-slate-900" : "text-slate-500")}
            >
              <Eye className="w-4 h-4" /> Preview
            </button>
          </div>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        </div>
      }
    >
    <div className="h-full flex flex-col" data-testid="account-form-builder">

      {/* Builder View */}
      {activeView === "builder" && (
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar - Field Palette */}
          <div className="w-64 border-r bg-slate-50 p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-slate-900 flex items-center gap-2">
                <PanelLeft className="w-4 h-4" /> Field Types
              </h3>
            </div>
            <div className="space-y-2">
              {Object.entries(FIELD_TYPES).map(([type, config]) => {
                const Icon = config.icon;
                return (
                  <button
                    key={type}
                    onClick={() => {
                      setShowNewField(true);
                      setEditingField({ field_type: type, name: "", section_id: sections[0]?.id });
                    }}
                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200 transition text-left"
                    data-testid={`add-field-type-${type}`}
                  >
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-white", config.color)}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-sm text-slate-700">{config.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Unassigned Fields */}
            {unassignedFields.length > 0 && (
              <div className="mt-6">
                <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Unassigned Fields</h4>
                <div className="space-y-1">
                  {unassignedFields.map(field => {
                    const typeConfig = FIELD_TYPES[field.field_type] || FIELD_TYPES.text;
                    const Icon = typeConfig.icon;
                    return (
                      <div key={field.id} className="flex items-center gap-2 p-2 bg-amber-50 rounded border border-amber-200 text-sm">
                        <Icon className="w-4 h-4 text-amber-600" />
                        <span className="text-amber-800">{field.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Main Canvas - Sections & Fields */}
          <div className="flex-1 p-6 overflow-y-auto bg-slate-100">
            <div className="max-w-4xl mx-auto">
              {/* Add Section Button */}
              <button
                onClick={() => setShowNewSection(true)}
                className="w-full mb-4 p-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-slate-400 hover:text-slate-600 flex items-center justify-center gap-2 transition"
                data-testid="add-section-btn"
              >
                <Plus className="w-4 h-4" /> Add Section
              </button>

              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="sections" type="section">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-4">
                      {sections.sort((a, b) => a.order - b.order).map((section, sectionIndex) => {
                        const sectionFields = fields.filter(f => f.section_id === section.id).sort((a, b) => a.order - b.order);
                        const isExpanded = expandedSections[section.id];

                        return (
                          <Draggable key={section.id} draggableId={section.id} index={sectionIndex}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={cn("bg-white rounded-xl border shadow-sm overflow-hidden",
                                  snapshot.isDragging && "shadow-lg ring-2 ring-blue-500")}
                                data-testid={`section-${section.id}`}
                              >
                                {/* Section Header */}
                                <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b">
                                  <div className="flex items-center gap-3">
                                    <div {...provided.dragHandleProps} className="cursor-grab hover:bg-slate-200 p-1 rounded">
                                      <GripVertical className="w-4 h-4 text-slate-400" />
                                    </div>
                                    <button onClick={() => toggleSectionExpand(section.id)} className="p-1">
                                      {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                                    </button>
                                    <span className="text-lg">{section.icon}</span>
                                    <div>
                                      <h3 className="font-medium text-slate-900">{section.name}</h3>
                                      <p className="text-xs text-slate-500">{sectionFields.length} fields • {section.columns} columns</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button onClick={() => setEditingSection(section)} className="p-1.5 hover:bg-slate-200 rounded" title="Edit Section">
                                      <Edit2 className="w-4 h-4 text-slate-500" />
                                    </button>
                                    <button onClick={() => deleteSection(section.id)} className="p-1.5 hover:bg-red-100 rounded" title="Delete Section">
                                      <Trash2 className="w-4 h-4 text-red-500" />
                                    </button>
                                  </div>
                                </div>

                                {/* Section Fields */}
                                {isExpanded && (
                                  <Droppable droppableId={`section-${section.id}`} type="field">
                                    {(provided, snapshot) => (
                                      <div
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                        className={cn("p-4 min-h-[80px]", snapshot.isDraggingOver && "bg-blue-50")}
                                      >
                                        <div className={cn("grid gap-3", `grid-cols-${Math.min(section.columns, 4)}`)}>
                                          {sectionFields.map((field, fieldIndex) => {
                                            const typeConfig = FIELD_TYPES[field.field_type] || FIELD_TYPES.text;
                                            const Icon = typeConfig.icon;
                                            return (
                                              <Draggable key={field.id} draggableId={field.id} index={fieldIndex}>
                                                {(provided, snapshot) => (
                                                  <div
                                                    ref={provided.innerRef}
                                                    {...provided.draggableProps}
                                                    className={cn(
                                                      "flex items-center gap-2 p-3 rounded-lg border bg-white group",
                                                      snapshot.isDragging && "shadow-lg ring-2 ring-blue-500",
                                                      field.field_type === "textarea" && "col-span-full"
                                                    )}
                                                    data-testid={`field-${field.id}`}
                                                  >
                                                    <div {...provided.dragHandleProps} className="cursor-grab">
                                                      <GripVertical className="w-4 h-4 text-slate-300" />
                                                    </div>
                                                    <div className={cn("w-6 h-6 rounded flex items-center justify-center text-white flex-shrink-0", typeConfig.color)}>
                                                      <Icon className="w-3 h-3" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                      <p className="text-sm font-medium text-slate-700 truncate">{field.name}</p>
                                                      <div className="flex items-center gap-1 mt-0.5">
                                                        {field.validation?.required && <span className="text-[10px] bg-red-100 text-red-600 px-1 rounded">Required</span>}
                                                        {field.is_system && <span className="text-[10px] bg-slate-100 text-slate-600 px-1 rounded">System</span>}
                                                      </div>
                                                    </div>
                                                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
                                                      <button onClick={() => setEditingField(field)} className="p-1 hover:bg-slate-100 rounded">
                                                        <Edit2 className="w-3 h-3 text-slate-400" />
                                                      </button>
                                                      {!field.is_system && (
                                                        <button onClick={() => deleteField(field.id)} className="p-1 hover:bg-red-50 rounded">
                                                          <Trash2 className="w-3 h-3 text-red-400" />
                                                        </button>
                                                      )}
                                                    </div>
                                                  </div>
                                                )}
                                              </Draggable>
                                            );
                                          })}
                                          {provided.placeholder}
                                        </div>
                                        {sectionFields.length === 0 && (
                                          <div className="text-center py-4 text-sm text-slate-400 border-2 border-dashed rounded-lg">
                                            Drag fields here or click a field type to add
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </Droppable>
                                )}
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>

              {sections.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  <Columns className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <p>No sections yet. Click "Add Section" to start building your form.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Preview View */}
      {activeView === "preview" && (
        <div className="flex-1 p-6 overflow-y-auto bg-slate-100">
          <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-6">Account Form Preview</h3>
            {sections.sort((a, b) => a.order - b.order).map(section => {
              const sectionFields = fields.filter(f => f.section_id === section.id && f.visible !== false).sort((a, b) => a.order - b.order);
              if (sectionFields.length === 0) return null;
              return (
                <div key={section.id} className="mb-6">
                  <h4 className="font-medium text-slate-800 mb-3 flex items-center gap-2">
                    <span>{section.icon}</span> {section.name}
                  </h4>
                  <div className={cn("grid gap-4", `grid-cols-${Math.min(section.columns, 2)}`)}>
                    {sectionFields.map(field => (
                      <div key={field.id} className={field.field_type === "textarea" ? "col-span-full" : ""}>
                        <label className="text-sm text-slate-600 mb-1 block">
                          {field.name} {field.validation?.required && <span className="text-red-500">*</span>}
                        </label>
                        {field.field_type === "textarea" ? (
                          <textarea className="input w-full h-20" placeholder={field.placeholder} disabled />
                        ) : field.field_type === "dropdown" ? (
                          <select className="input w-full" disabled>
                            <option>Select {field.name}...</option>
                            {field.options?.map(opt => <option key={opt.value}>{opt.label}</option>)}
                          </select>
                        ) : field.field_type === "checkbox" ? (
                          <label className="flex items-center gap-2">
                            <input type="checkbox" disabled className="rounded" />
                            <span className="text-sm">{field.name}</span>
                          </label>
                        ) : (
                          <input type="text" className="input w-full" placeholder={field.placeholder || field.name} disabled />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* New Section Modal */}
      {showNewSection && (
        <SectionModal
          section={null}
          onSave={addSection}
          onClose={() => setShowNewSection(false)}
        />
      )}

      {/* Edit Section Modal */}
      {editingSection && (
        <SectionModal
          section={editingSection}
          onSave={(data) => updateSection(editingSection.id, data)}
          onClose={() => setEditingSection(null)}
        />
      )}

      {/* New/Edit Field Modal */}
      {(showNewField || editingField) && (
        <FieldModal
          field={editingField}
          sections={sections}
          onSave={editingField?.id ? (data) => updateField(editingField.id, data) : addField}
          onClose={() => { setShowNewField(false); setEditingField(null); }}
        />
      )}
    </div>
  );
};

// Section Modal Component
const SectionModal = ({ section, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    name: section?.name || "",
    icon: section?.icon || "📋",
    columns: section?.columns || 2,
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-md m-4 p-6">
        <h3 className="text-lg font-semibold mb-4">{section ? "Edit Section" : "Add Section"}</h3>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-slate-600">Section Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input w-full"
              placeholder="e.g., Basic Information"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-slate-600">Icon (emoji)</label>
              <input
                type="text"
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                className="input w-full text-center text-xl"
              />
            </div>
            <div>
              <label className="text-sm text-slate-600">Columns</label>
              <select
                value={formData.columns}
                onChange={(e) => setFormData({ ...formData, columns: parseInt(e.target.value) })}
                className="input w-full"
              >
                <option value={1}>1 Column</option>
                <option value={2}>2 Columns</option>
                <option value={3}>3 Columns</option>
                <option value={4}>4 Columns</option>
              </select>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={() => formData.name && onSave(formData)} className="btn-primary">
            {section ? "Update" : "Add"} Section
          </button>
        </div>
      </div>
    </div>
  );
};

// Field Modal Component
const FieldModal = ({ field, sections, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    name: field?.name || "",
    field_type: field?.field_type || "text",
    section_id: field?.section_id || sections[0]?.id || "",
    description: field?.description || "",
    placeholder: field?.placeholder || "",
    required: field?.validation?.required || false,
    show_in_list: field?.show_in_list || false,
    show_in_card: field?.show_in_card || false,
    options: field?.options || [],
  });
  const [newOption, setNewOption] = useState({ value: "", label: "" });

  const addOption = () => {
    if (!newOption.value || !newOption.label) return;
    setFormData({ ...formData, options: [...formData.options, newOption] });
    setNewOption({ value: "", label: "" });
  };

  const removeOption = (idx) => {
    setFormData({ ...formData, options: formData.options.filter((_, i) => i !== idx) });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-lg m-4 p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold mb-4">{field?.id ? "Edit Field" : "Add Field"}</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-sm text-slate-600">Field Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input w-full"
                placeholder="e.g., Contract Value"
                autoFocus
              />
            </div>
            <div>
              <label className="text-sm text-slate-600">Field Type</label>
              <select
                value={formData.field_type}
                onChange={(e) => setFormData({ ...formData, field_type: e.target.value })}
                className="input w-full"
                disabled={field?.is_system}
              >
                {Object.entries(FIELD_TYPES).map(([type, config]) => (
                  <option key={type} value={type}>{config.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-slate-600">Section</label>
              <select
                value={formData.section_id}
                onChange={(e) => setFormData({ ...formData, section_id: e.target.value })}
                className="input w-full"
              >
                <option value="">Unassigned</option>
                {sections.map(s => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-sm text-slate-600">Placeholder</label>
              <input
                type="text"
                value={formData.placeholder}
                onChange={(e) => setFormData({ ...formData, placeholder: e.target.value })}
                className="input w-full"
              />
            </div>
          </div>

          {/* Options for Dropdown */}
          {formData.field_type === "dropdown" && (
            <div>
              <label className="text-sm text-slate-600 mb-2 block">Dropdown Options</label>
              <div className="space-y-2 mb-2">
                {formData.options.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2 rounded">
                    <span className="text-sm flex-1">{opt.label} ({opt.value})</span>
                    <button onClick={() => removeOption(idx)} className="text-red-500"><Trash2 className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newOption.value}
                  onChange={(e) => setNewOption({ ...newOption, value: e.target.value })}
                  className="input flex-1"
                  placeholder="Value"
                />
                <input
                  type="text"
                  value={newOption.label}
                  onChange={(e) => setNewOption({ ...newOption, label: e.target.value })}
                  className="input flex-1"
                  placeholder="Label"
                />
                <button onClick={addOption} className="btn-secondary text-sm">Add</button>
              </div>
            </div>
          )}

          {/* Checkboxes */}
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formData.required}
                onChange={(e) => setFormData({ ...formData, required: e.target.checked })}
                className="rounded"
              />
              Required
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formData.show_in_list}
                onChange={(e) => setFormData({ ...formData, show_in_list: e.target.checked })}
                className="rounded"
              />
              Show in List
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formData.show_in_card}
                onChange={(e) => setFormData({ ...formData, show_in_card: e.target.checked })}
                className="rounded"
              />
              Show in Card
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={() => formData.name && onSave(formData)} className="btn-primary">
            {field?.id ? "Update" : "Add"} Field
          </button>
        </div>
      </div>
    </div>
  );
};

export default AccountFormBuilder;
