import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { updateAgent } from "../../../apis/agentAPI";
import { getAllRegions, getGovernoratesByRegion, getDelegationsByGovernorate, getRegionsByGovernorate } from "../../../apis/locationApi";
import { getUsersByDelegation } from "../../../apis/userAPI";
import Agent from "../../../models/Agent";
import Region from "../../../models/Region";
import Governorate from "../../../models/Governorate";
import Delegation from "../../../models/Delegation";
import User from "../../../models/User";
import { Input } from "../../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { Button } from "../../../components/ui/button";
import { Label } from "../../../components/ui/label";
import "../AdminDashboard.css";

import { useError } from "../../../context/ErrorContext";
import "../AdminDashboard.css";
import { ViewMode } from "../adminTypes";

interface EditAgentProps {
    selectedAgent: Agent | null;
    setAgents: React.Dispatch<React.SetStateAction<Agent[]>>;
    setSelectedAgent: (agent: Agent | null) => void;
    setView: (view: ViewMode) => void;
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

const NAME_REGEX = /^[a-zA-Z]{2,50}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\d{8}$/;

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

    // Validation Helpers
    const validateName = useCallback((value: string, field: string): string => {
        const trimmed = value.trim();
        if (!trimmed) return `${field} is required.`;
        if (!NAME_REGEX.test(trimmed)) return `${field} must be 2–50 letters only.`;
        return "";
    }, []);

    const validateEmail = useCallback((value: string): string => {
        const trimmed = value.trim();
        if (!trimmed) return "Email is required.";
        if (!EMAIL_REGEX.test(trimmed)) return "Please enter a valid email.";
        return "";
    }, []);

    const validatePhone = useCallback((value: string): string => {
        const digits = value.replace(/[^\d]/g, "");
        if (!digits) return "Phone number is required.";
        if (!PHONE_REGEX.test(digits)) return "Phone number must be exactly 8 digits.";
        return "";
    }, []);

    // Fetch all regions and initialize with agent's data
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

    // Fetch governorates based on selected region
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

    // Fetch delegations based on selected governorate
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

    // Fetch supervisors based on selected delegation
    useEffect(() => {
        const fetchSupervisors = async () => {
            if (formData.delegationID) {
                try {
                    const response = await getUsersByDelegation(formData.delegationID);
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedAgent?.agentID) return;

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

    const handleCancel = useCallback(() => {
        setSelectedAgent(null);
        setView("agents");
    }, [setSelectedAgent, setView]);

    if (!selectedAgent) return null;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="edit-agent-form"
        >
            <h2>{t("adminDashboard.agents.editAgent")}</h2>
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <Label htmlFor="name">{t("adminDashboard.agents.name")}</Label>
                    <Input
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        required
                        className={touched.name && formErrors.name ? "invalid-vibrate" : ""}
                    />
                    {touched.name && formErrors.name && (
                        <span className="error-text">{formErrors.name}</span>
                    )}
                </div>
                <div className="form-group">
                    <Label htmlFor="lastname">{t("adminDashboard.agents.lastname")}</Label>
                    <Input
                        id="lastname"
                        name="lastname"
                        value={formData.lastname}
                        onChange={handleInputChange}
                        required
                        className={touched.lastname && formErrors.lastname ? "invalid-vibrate" : ""}
                    />
                    {touched.lastname && formErrors.lastname && (
                        <span className="error-text">{formErrors.lastname}</span>
                    )}
                </div>
                <div className="form-group">
                    <Label htmlFor="email">{t("adminDashboard.agents.email")}</Label>
                    <Input
                        id="email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        required
                        className={touched.email && formErrors.email ? "invalid-vibrate" : ""}
                    />
                    {touched.email && formErrors.email && (
                        <span className="error-text">{formErrors.email}</span>
                    )}
                </div>
                <div className="form-group">
                    <Label htmlFor="phone">{t("adminDashboard.agents.phone")}</Label>
                    <Input
                        id="phone"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        required
                        maxLength={8}
                        className={touched.phone && formErrors.phone ? "invalid-vibrate" : ""}
                    />
                    {touched.phone && formErrors.phone && (
                        <span className="error-text">{formErrors.phone}</span>
                    )}
                </div>
                <div className="form-group">
                    <Label htmlFor="region">{t("adminDashboard.agents.region")}</Label>
                    <Select
                        onValueChange={(value) => setSelectedRegion(value)}
                        value={selectedRegion}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder={t("adminDashboard.agents.selectRegion")} />
                        </SelectTrigger>
                        <SelectContent>
                            {regions.map((region) => (
                                <SelectItem key={region.regionID} value={region.regionID}>
                                    {region.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="form-group">
                    <Label htmlFor="governorate">{t("adminDashboard.agents.governorate")}</Label>
                    <Select
                        onValueChange={(value) => setSelectedGovernorate(value)}
                        value={selectedGovernorate}
                        disabled={!selectedRegion}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder={t("adminDashboard.agents.selectGovernorate")} />
                        </SelectTrigger>
                        <SelectContent>
                            {governorates.map((gov) => (
                                <SelectItem key={gov.governorateID} value={gov.governorateID}>
                                    {gov.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="form-group">
                    <Label htmlFor="delegationID">{t("adminDashboard.agents.delegation")}</Label>
                    <Select
                        onValueChange={(value) => handleSelectChange("delegationID", value)}
                        value={formData.delegationID}
                        disabled={!selectedGovernorate}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder={t("adminDashboard.agents.selectDelegation")} />
                        </SelectTrigger>
                        <SelectContent>
                            {delegations.map((del) => (
                                <SelectItem key={del.delegationID} value={del.delegationID}>
                                    {del.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="form-group">
                    <Label htmlFor="supervisorID">{t("adminDashboard.agents.supervisor")}</Label>
                    <Select
                        onValueChange={(value) => handleSelectChange("supervisorID", value)}
                        value={formData.supervisorID}
                        disabled={!formData.delegationID}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder={t("adminDashboard.agents.selectSupervisor")} />
                        </SelectTrigger>
                        <SelectContent>
                            {supervisors.map((sup) => (
                                <SelectItem key={sup.userID} value={sup.userID}>
                                    {sup.firstname} {sup.lastname}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="form-actions">
                    <Button type="submit" disabled={loading}>
                        {loading ? t("adminDashboard.loading") : t("adminDashboard.actions.submit")}
                    </Button>
                    <Button type="button" variant="secondary" onClick={handleCancel}>
                        {t("adminDashboard.actions.cancel")}
                    </Button>
                </div>
            </form>
        </motion.div>
    );
};

export default EditAgent;