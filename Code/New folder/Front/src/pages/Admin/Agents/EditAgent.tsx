import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { updateAgent } from "../../../apis/agentAPI";
import { getAllRegions, getGovernoratesByRegion, getDelegationsByGovernorate, getRegionsByGovernorate } from "../../../apis/locationApi";
import { getUsersByDelegation, getUsersByRole } from "../../../apis/userAPI";
import Agent from "../../../models/Agent";
import Region from "../../../models/Region";
import Governorate from "../../../models/Governorate";
import Delegation from "../../../models/Delegation";
import User from "../../../models/User";
import { useError } from "../../../context/ErrorContext";
import "../AdminDashboard.css";

interface EditAgentProps {
    selectedAgent: Agent | null;
    setAgents: React.Dispatch<React.SetStateAction<Agent[]>>;
    setSelectedAgent: (agent: Agent | null) => void;
    setView: (view: string) => void;
}

interface FormErrors {
    name: string;
    lastname: string;
    email: string;
    phone: string;
}

interface TouchedFields {
    name: boolean;
    lastname: boolean;
    email: boolean;
    phone: boolean;
}

const EditAgent: React.FC<EditAgentProps> = ({
    selectedAgent,
    setAgents,
    setSelectedAgent,
    setView,
}) => {
    const { t } = useTranslation();
    const { setError: setGlobalError } = useError();
    const [formData, setFormData] = useState({
        name: selectedAgent?.name || "",
        lastname: selectedAgent?.lastname || "",
        email: selectedAgent?.email || "",
        phone: selectedAgent?.phone || "",
        supervisorID: selectedAgent?.supervisorID || "",
        delegationID: selectedAgent?.delegationID || "",
    });
    const [rawPhone, setRawPhone] = useState(selectedAgent?.phone || "");
    const [formErrors, setFormErrors] = useState<FormErrors>({
        name: "",
        lastname: "",
        email: "",
        phone: "",
    });
    const [touched, setTouched] = useState<TouchedFields>({
        name: false,
        lastname: false,
        email: false,
        phone: false,
    });
    const [regions, setRegions] = useState<Region[]>([]);
    const [governorates, setGovernorates] = useState<Governorate[]>([]);
    const [delegations, setDelegations] = useState<Delegation[]>([]);
    const [supervisors, setSupervisors] = useState<User[]>([]);
    const [selectedRegion, setSelectedRegion] = useState<string>("");
    const [selectedGovernorate, setSelectedGovernorate] = useState<string>("");
    const [loading, setLoading] = useState(false);

    const validateName = useCallback((value: string, field: string): string => {
        const trimmed = value.trim();
        if (!trimmed) return `${field} is required`;
        if (trimmed.length < 3) return `${field} must be at least 3 characters`;
        if (trimmed.length > 20) return `${field} must be 20 characters or less`;
        if (!/^[a-zA-Z\s'-]+$/.test(trimmed))
            return `${field} can only contain letters, spaces, hyphens, or apostrophes`;
        return "";
    }, []);

    const validateEmail = useCallback((value: string): string => {
        const trimmed = value.trim();
        if (!trimmed) return "Email is required";
        if (trimmed.length > 70) return "Email must be 70 characters or less";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed))
            return "Invalid email format";
        return "";
    }, []);

    const validatePhone = useCallback((value: string): string => {
        const digits = value.replace(/[^\d]/g, "");
        if (!digits) return "Phone is required";
        if (digits.length !== 8) return "Phone must be 8 digits";
        return "";
    }, []);

    const formatPhoneDisplay = useCallback((rawValue: string): string => {
        const digits = rawValue.replace(/[^\d]/g, "");
        let formatted = "";
        if (digits.length > 0) formatted += digits.slice(0, 2);
        if (digits.length > 2) formatted += " " + digits.slice(2, 5);
        if (digits.length > 5) formatted += " " + digits.slice(5, 8);
        return formatted;
    }, []);

    useEffect(() => {
        const fetchRegions = async () => {
            try {
                const response = await getAllRegions();
                setRegions(response);
                if (selectedAgent?.Delegation?.Governorate.governorateID) {
                    const govResponse = await getRegionsByGovernorate(selectedAgent.Delegation.Governorate.governorateID);
                    if (govResponse.length > 0) {
                        setSelectedRegion(govResponse[0].regionID);
                    }
                }
            } catch (err) {
                setGlobalError(t("adminDashboard.error.fetchRegionsFailed"));
            }
        };
        if (selectedAgent) {
            fetchRegions();
        }
    }, [selectedAgent, setGlobalError, t]);

    useEffect(() => {
        const fetchGovernorates = async () => {
            if (selectedRegion) {
                try {
                    const response = await getGovernoratesByRegion(selectedRegion);
                    setGovernorates(response);
                    if (selectedAgent?.Delegation?.Governorate.governorateID) {
                        setSelectedGovernorate(selectedAgent.Delegation.Governorate.governorateID);
                    } else {
                        setSelectedGovernorate("");
                    }
                } catch (err) {
                    setGlobalError(t("adminDashboard.error.fetchGovernoratesFailed"));
                }
            } else {
                setGovernorates([]);
                setDelegations([]);
                setSupervisors([]);
                setFormData((prev) => ({ ...prev, delegationID: "", supervisorID: "" }));
            }
        };
        fetchGovernorates();
    }, [selectedRegion, selectedAgent, setGlobalError, t]);

    useEffect(() => {
        const fetchDelegations = async () => {
            if (selectedGovernorate) {
                try {
                    const response = await getDelegationsByGovernorate(selectedGovernorate);
                    setDelegations(response);
                    if (selectedAgent?.delegationID) {
                        setFormData((prev) => ({ ...prev, delegationID: selectedAgent.delegationID }));
                    } else {
                        setFormData((prev) => ({ ...prev, delegationID: "" }));
                    }
                } catch (err) {
                    setGlobalError(t("adminDashboard.error.fetchDelegationsFailed"));
                }
            } else {
                setDelegations([]);
                setSupervisors([]);
                setFormData((prev) => ({ ...prev, delegationID: "", supervisorID: "" }));
            }
        };
        fetchDelegations();
    }, [selectedGovernorate, selectedAgent, setGlobalError, t]);

    useEffect(() => {
        const fetchSupervisors = async () => {
            if (formData.delegationID) {
                try {
                    const response = await getUsersByRole(import.meta.env.VITE_ROLES_SUPERVISOR);
                    setSupervisors(response);
                    if (selectedAgent?.supervisorID) {
                        setFormData((prev) => ({ ...prev, supervisorID: selectedAgent.supervisorID! }));
                    } else {
                        setFormData((prev) => ({ ...prev, supervisorID: "" }));
                    }
                } catch (err) {
                    setGlobalError(t("adminDashboard.error.fetchSupervisorsFailed"));
                }
            } else {
                setSupervisors([]);
                setFormData((prev) => ({ ...prev, supervisorID: "" }));
            }
        };
        fetchSupervisors();
    }, [formData.delegationID, selectedAgent, setGlobalError, t]);

    const handleInputChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const { name, value } = e.target;
            setFormData((prev) => ({ ...prev, [name]: value }));
            setTouched((prev) => ({ ...prev, [name]: true }));
            if (name === "name") {
                setFormErrors((prev) => ({
                    ...prev,
                    name: validateName(value, "Name"),
                }));
            } else if (name === "lastname") {
                setFormErrors((prev) => ({
                    ...prev,
                    lastname: validateName(value, "Lastname"),
                }));
            } else if (name === "email") {
                setFormErrors((prev) => ({
                    ...prev,
                    email: validateEmail(value),
                }));
            } else if (name === "phone") {
                const digits = value.replace(/[^\d]/g, "").slice(0, 8);
                setRawPhone(digits);
                setFormData((prev) => ({ ...prev, phone: digits }));
                setFormErrors((prev) => ({
                    ...prev,
                    phone: validatePhone(digits),
                }));
            }
        },
        [validateName, validateEmail, validatePhone]
    );

    const handleSelectChange = useCallback(
        (name: string, value: string) => {
            setFormData((prev) => ({ ...prev, [name]: value }));
        },
        []
    );

    const handleSaveAgentEdit = async () => {
        if (!selectedAgent) return;

        const errors: FormErrors = {
            name: validateName(formData.name, "Name"),
            lastname: validateName(formData.lastname, "Lastname"),
            email: validateEmail(formData.email),
            phone: validatePhone(rawPhone || formData.phone),
        };
        setFormErrors(errors);
        setTouched({
            name: true,
            lastname: true,
            email: true,
            phone: true,
        });

        if (Object.values(errors).some((error) => error)) {
            setGlobalError(t("adminDashboard.error.fixErrors"));
            return;
        }

        if (!formData.delegationID || !formData.supervisorID) {
            setGlobalError(t("adminDashboard.error.delegationAndSupervisorRequired"));
            return;
        }

        setLoading(true);
        try {
            const updatedAgent = await updateAgent(selectedAgent.agentID, formData);
            setAgents((prev) =>
                prev.map((agent) =>
                    agent.agentID === selectedAgent.agentID ? updatedAgent : agent
                )
            );
            setSelectedAgent(updatedAgent);
            setGlobalError(t("adminDashboard.agents.updateSuccess"));
            setView("agent-details");
        } catch (err) {
            setGlobalError(t("adminDashboard.error.updateFailed"));
        } finally {
            setLoading(false);
        }
    };

    const handleCancelEdit = useCallback(() => {
        setSelectedAgent(null);
        setView("agents");
    }, [setSelectedAgent, setView]);

    if (!selectedAgent) return null;

    return (
        <motion.div
            className="details-card agent-form-container"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
        >
            <div className="card-header">
                <h2>{t("adminDashboard.agents.editAgent")}</h2>
            </div>
            <div className="u-profile-panel">
                <div className="u-profile-body">
                    <div className="u-profile-header">
                        <div className="u-profile-image-placeholder">
                            {formData.name[0] || selectedAgent.name[0]}
                            {formData.lastname[0] || selectedAgent.lastname[0]}
                        </div>
                        <div className="u-profile-identity">
                            <input
                                id="name"
                                name="name"
                                type="text"
                                value={formData.name}
                                onChange={handleInputChange}
                                onBlur={() => setTouched((prev) => ({ ...prev, name: true }))}
                                placeholder={t("adminDashboard.agents.enterName")}
                                className={`u-profile-name user-edit-input ${touched.name && formErrors.name ? "invalid-vibrate" : ""}`}
                            />
                            {touched.name && formErrors.name && (
                                <span className="error-text">{formErrors.name}</span>
                            )}
                            <input
                                id="lastname"
                                name="lastname"
                                type="text"
                                value={formData.lastname}
                                onChange={handleInputChange}
                                onBlur={() => setTouched((prev) => ({ ...prev, lastname: true }))}
                                placeholder={t("adminDashboard.agents.enterLastname")}
                                className={`u-profile-name user-edit-input ${touched.lastname && formErrors.lastname ? "invalid-vibrate" : ""}`}
                            />
                            {touched.lastname && formErrors.lastname && (
                                <span className="error-text">{formErrors.lastname}</span>
                            )}
                            <span className="u-profile-id">ID: {selectedAgent.agentID}</span>
                        </div>
                    </div>
                    <div className="u-profile-info">
                        <div className="u-info-row">
                            <span className="u-info-label">{t("adminDashboard.agents.email")}</span>
                            <div className="u-info-value">
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    value={formData.email}
                                    onChange={handleInputChange}
                                    onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
                                    placeholder={t("adminDashboard.agents.enterEmail")}
                                    className={`user-edit-input ${touched.email && formErrors.email ? "invalid-vibrate" : ""}`}
                                />
                                {touched.email && formErrors.email && (
                                    <span className="error-text">{formErrors.email}</span>
                                )}
                            </div>
                        </div>
                        <div className="u-info-row">
                            <span className="u-info-label">{t("adminDashboard.agents.phone")}</span>
                            <div className="u-info-value">
                                <input
                                    id="phone"
                                    name="phone"
                                    type="tel"
                                    value={formatPhoneDisplay(rawPhone)}
                                    onChange={handleInputChange}
                                    onBlur={() => setTouched((prev) => ({ ...prev, phone: true }))}
                                    placeholder="XX XXX XXX"
                                    maxLength={10}
                                    className={`user-edit-input ${touched.phone && formErrors.phone ? "invalid-vibrate" : ""}`}
                                />
                                {touched.phone && formErrors.phone && (
                                    <span className="error-text">{formErrors.phone}</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div className="dropdown-stack">
                <div className="dropdown-unit">
                    <div className="dropdown-bar">
                        <label htmlFor="region">{t("adminDashboard.agents.region")}</label>
                        <select
                            id="region"
                            value={selectedRegion}
                            onChange={(e) => setSelectedRegion(e.target.value)}
                            className={selectedRegion ? "" : "input-error"}
                        >
                            <option value="">{t("adminDashboard.agents.selectRegion")}</option>
                            {regions.map((region) => (
                                <option key={region.regionID} value={region.regionID}>
                                    {region.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="dropdown-bar">
                        <label htmlFor="governorate">{t("adminDashboard.agents.governorate")}</label>
                        <select
                            id="governorate"
                            value={selectedGovernorate}
                            onChange={(e) => setSelectedGovernorate(e.target.value)}
                            disabled={!selectedRegion}
                            className={selectedGovernorate ? "" : "input-error"}
                        >
                            <option value="">{t("adminDashboard.agents.selectGovernorate")}</option>
                            {governorates.map((gov) => (
                                <option key={gov.governorateID} value={gov.governorateID}>
                                    {gov.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="dropdown-bar">
                        <label htmlFor="delegationID">{t("adminDashboard.agents.delegation")}</label>
                        <select
                            id="delegationID"
                            value={formData.delegationID}
                            onChange={(e) => handleSelectChange("delegationID", e.target.value)}
                            disabled={!selectedGovernorate}
                            className={formData.delegationID ? "" : "input-error"}
                        >
                            <option value="">{t("adminDashboard.agents.selectDelegation")}</option>
                            {delegations.map((del) => (
                                <option key={del.delegationID} value={del.delegationID}>
                                    {del.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="dropdown-bar">
                        <label htmlFor="supervisorID">{t("adminDashboard.agents.supervisor")}</label>
                        <select
                            id="supervisorID"
                            value={formData.supervisorID}
                            onChange={(e) => handleSelectChange("supervisorID", e.target.value)}
                            disabled={!formData.delegationID}
                            className={formData.supervisorID ? "" : "input-error"}
                        >
                            <option value="">{t("adminDashboard.agents.selectSupervisor")}</option>
                            {supervisors.map((sup) => (
                                <option key={sup.userID} value={sup.userID}>
                                    {sup.firstname} {sup.lastname}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>
            <div className="user-edit-actions">
                <button
                    className="action-button"
                    onClick={handleSaveAgentEdit}
                    disabled={loading}
                >
                    {loading ? t("adminDashboard.loading") : t("adminDashboard.actions.save")}
                </button>
                <button
                    className="cancel-button"
                    onClick={handleCancelEdit}
                >
                    {t("adminDashboard.actions.cancel")}
                </button>
            </div>
        </motion.div>
    );
};

export default EditAgent;