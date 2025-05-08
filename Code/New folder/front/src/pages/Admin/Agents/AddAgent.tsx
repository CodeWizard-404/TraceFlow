import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { createAgent } from "../../../apis/agentAPI";
import { getAllRegions, getGovernoratesByRegion, getDelegationsByGovernorate } from "../../../apis/locationApi";
import { getUsersByDelegation } from "../../../apis/userAPI";
import Agent from "../../../models/Agent";
import Region from "../../../models/Region";
import Governorate from "../../../models/Governorate";
import Delegation from "../../../models/Delegation";
import User from "../../../models/User";
import "../AdminDashboard.css";

interface AddAgentProps {
    setAgents: React.Dispatch<React.SetStateAction<Agent[]>>;
    setError: (error: string | null) => void;
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

const AddAgentSkeleton: React.FC = () => (
    <div className="form-card form-card-0 skeleton">
        <div className="form-section">
            <div className="custom-skeleton pulsing" style={{ width: "150px", height: "24px", marginBottom: "16px" }} />
            <div className="form-row">
                <div className="form-group">
                    <div className="custom-skeleton pulsing" style={{ width: "80px", height: "16px", marginBottom: "8px" }} />
                    <div className="custom-skeleton pulsing" style={{ width: "100%", height: "32px" }} />
                </div>
                <div className="form-group">
                    <div className="custom-skeleton pulsing" style={{ width: "80px", height: "16px", marginBottom: "8px" }} />
                    <div className="custom-skeleton pulsing" style={{ width: "100%", height: "32px" }} />
                </div>
            </div>
        </div>
        <div className="form-section">
            <hr />
            <div className="form-row">
                <div className="form-group">
                    <div className="custom-skeleton pulsing" style={{ width: "80px", height: "16px", marginBottom: "8px" }} />
                    <div className="custom-skeleton pulsing" style={{ width: "100%", height: "32px" }} />
                </div>
                <div className="form-group">
                    <div className="custom-skeleton pulsing" style={{ width: "80px", height: "16px", marginBottom: "8px" }} />
                    <div className="custom-skeleton pulsing" style={{ width: "100%", height: "32px" }} />
                </div>
            </div>
        </div>
        <div className="dropdown-stack">
            {[...Array(2)].map((_, i) => (
                <div key={i} className="dropdown-unit">
                    <div className="dropdown-bar">
                        <div className="custom-skeleton pulsing" style={{ width: "150px", height: "20px" }} />
                        <div className="custom-skeleton pulsing" style={{ width: "20px", height: "20px" }} />
                    </div>
                </div>
            ))}
        </div>
        <div className="custom-skeleton pulsing" style={{ width: "120px", height: "40px", marginTop: "16px" }} />
    </div>
);

const AddAgent: React.FC<AddAgentProps> = ({ setAgents, setError, setView }) => {
    const { t } = useTranslation();
    const [formData, setFormData] = useState({
        name: "",
        lastname: "",
        email: "",
        phone: "",
        supervisorID: "",
        delegationID: "",
    });
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
    const [loading, setLoading] = useState(true);

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
                setLoading(false);
            } catch (err) {
                setError(t("adminDashboard.error.fetchRegionsFailed"));
                setLoading(false);
            }
        };
        fetchRegions();
    }, [setError, t]);

    useEffect(() => {
        if (selectedRegion) {
            const fetchGovernorates = async () => {
                try {
                    const response = await getGovernoratesByRegion(selectedRegion);
                    setGovernorates(response);
                    setSelectedGovernorate("");
                    setDelegations([]);
                    setSupervisors([]);
                    setFormData((prev) => ({ ...prev, delegationID: "", supervisorID: "" }));
                } catch (err) {
                    setError(t("adminDashboard.error.fetchGovernoratesFailed"));
                }
            };
            fetchGovernorates();
        } else {
            setGovernorates([]);
            setDelegations([]);
            setSupervisors([]);
            setFormData((prev) => ({ ...prev, delegationID: "", supervisorID: "" }));
        }
    }, [selectedRegion, setError, t]);

    useEffect(() => {
        if (selectedGovernorate) {
            const fetchDelegations = async () => {
                try {
                    const response = await getDelegationsByGovernorate(selectedGovernorate);
                    setDelegations(response);
                    setFormData((prev) => ({ ...prev, delegationID: "", supervisorID: "" }));
                    setSupervisors([]);
                } catch (err) {
                    setError(t("adminDashboard.error.fetchDelegationsFailed"));
                }
            };
            fetchDelegations();
        } else {
            setDelegations([]);
            setSupervisors([]);
            setFormData((prev) => ({ ...prev, delegationID: "", supervisorID: "" }));
        }
    }, [selectedGovernorate, setError, t]);

    useEffect(() => {
        if (formData.delegationID) {
            const fetchSupervisors = async () => {
                try {
                    const response = await getUsersByDelegation(formData.delegationID);
                    setSupervisors(response);
                    setFormData((prev) => ({ ...prev, supervisorID: "" }));
                } catch (err) {
                    setError(t("adminDashboard.error.fetchSupervisorsFailed"));
                }
            };
            fetchSupervisors();
        } else {
            setSupervisors([]);
            setFormData((prev) => ({ ...prev, supervisorID: "" }));
        }
    }, [formData.delegationID, setError, t]);

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

    const handleSubmit = async () => {
        const errors: FormErrors = {
            name: validateName(formData.name, "Name"),
            lastname: validateName(formData.lastname, "Lastname"),
            email: validateEmail(formData.email),
            phone: validatePhone(formData.phone),
        };
        setFormErrors(errors);
        setTouched({
            name: true,
            lastname: true,
            email: true,
            phone: true,
        });

        if (Object.values(errors).some((error) => error)) {
            setError(t("adminDashboard.error.fixErrors"));
            return;
        }

        if (!formData.delegationID || !formData.supervisorID) {
            setError(t("adminDashboard.error.delegationAndSupervisorRequired"));
            return;
        }

        setLoading(true);
        try {
            const newAgent = await createAgent(formData);
            setAgents((prev) => [...prev, newAgent]);
            setError(t("adminDashboard.agents.createSuccess"));
            setView("agents");
        } catch (err) {
            setError(t("adminDashboard.error.createFailed"));
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <AddAgentSkeleton />;
    }

    return (
        <motion.div
            className="form-card form-card-0 agent-form-container"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
        >
            <div className="form-section">
                <div className="card-header">
                    <h2>{t("adminDashboard.agents.addAgent")}</h2>
                </div>
                <div className="form-row">
                    <div className="form-group">
                        <label htmlFor="name">{t("adminDashboard.agents.name")}</label>
                        <input
                            id="name"
                            name="name"
                            type="text"
                            value={formData.name}
                            onChange={handleInputChange}
                            onBlur={() => setTouched((prev) => ({ ...prev, name: true }))}
                            placeholder={t("adminDashboard.agents.enterName")}
                            className={touched.name && formErrors.name ? "input-error" : ""}
                        />
                        {touched.name && formErrors.name && (
                            <div className="error-message">{formErrors.name}</div>
                        )}
                    </div>
                    <div className="form-group">
                        <label htmlFor="lastname">{t("adminDashboard.agents.lastname")}</label>
                        <input
                            id="lastname"
                            name="lastname"
                            type="text"
                            value={formData.lastname}
                            onChange={handleInputChange}
                            onBlur={() => setTouched((prev) => ({ ...prev, lastname: true }))}
                            placeholder={t("adminDashboard.agents.enterLastname")}
                            className={touched.lastname && formErrors.lastname ? "input-error" : ""}
                        />
                        {touched.lastname && formErrors.lastname && (
                            <div className="error-message">{formErrors.lastname}</div>
                        )}
                    </div>
                </div>
            </div>
            <div className="form-section">
                <div className="form-row">
                    <div className="form-group">
                        <label htmlFor="email">{t("adminDashboard.agents.email")}</label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            value={formData.email}
                            onChange={handleInputChange}
                            onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
                            placeholder={t("adminDashboard.agents.enterEmail")}
                            className={touched.email && formErrors.email ? "input-error" : ""}
                        />
                        {touched.email && formErrors.email && (
                            <div className="error-message">{formErrors.email}</div>
                        )}
                    </div>
                    <div className="form-group">
                        <label htmlFor="phone">{t("adminDashboard.agents.phone")}</label>
                        <input
                            id="phone"
                            name="phone"
                            type="tel"
                            value={formatPhoneDisplay(formData.phone)}
                            onChange={handleInputChange}
                            onBlur={() => setTouched((prev) => ({ ...prev, phone: true }))}
                            placeholder="XX XXX XXX"
                            maxLength={10}
                            className={touched.phone && formErrors.phone ? "input-error" : ""}
                        />
                        {touched.phone && formErrors.phone && (
                            <div className="error-message">{formErrors.phone}</div>
                        )}
                    </div>
                </div>
            </div>
            <hr />
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
            <hr />
            <button
                className="action-button"
                onClick={handleSubmit}
                disabled={loading}
            >
                {loading ? t("adminDashboard.loading") : t("adminDashboard.actions.createAgent")}
            </button>
        </motion.div>
    );
};

export default AddAgent;