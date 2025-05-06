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
import { Input } from "../../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { Button } from "../../../components/ui/button";
import { Label } from "../../../components/ui/label";
import "../AdminDashboard.css";

interface AddAgentProps {
    setAgents: React.Dispatch<React.SetStateAction<Agent[]>>;
    setError: (error: string | null) => void;
    setView: (view: string) => void;
}

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
    const [regions, setRegions] = useState<Region[]>([]);
    const [governorates, setGovernorates] = useState<Governorate[]>([]);
    const [delegations, setDelegations] = useState<Delegation[]>([]);
    const [supervisors, setSupervisors] = useState<User[]>([]);
    const [selectedRegion, setSelectedRegion] = useState<string>("");
    const [selectedGovernorate, setSelectedGovernorate] = useState<string>("");
    const [loading, setLoading] = useState(false);

    // Fetch all regions on mount
    useEffect(() => {
        const fetchRegions = async () => {
            try {
                const response = await getAllRegions();
                setRegions(response);
            } catch (err) {
                setError(t("adminDashboard.error.fetchRegionsFailed"));
            }
        };
        fetchRegions();
    }, [setError, t]);

    // Fetch governorates when region is selected
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

    // Fetch delegations when governorate is selected
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

    // Fetch supervisors when delegation is selected
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
        },
        []
    );

    const handleSelectChange = useCallback(
        (name: string, value: string) => {
            setFormData((prev) => ({ ...prev, [name]: value }));
        },
        []
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
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

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="add-agent-form"
        >
            <h2>{t("adminDashboard.agents.addAgent")}</h2>
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <Label htmlFor="name">{t("adminDashboard.agents.name")}</Label>
                    <Input
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        required
                    />
                </div>
                <div className="form-group">
                    <Label htmlFor="lastname">{t("adminDashboard.agents.lastname")}</Label>
                    <Input
                        id="lastname"
                        name="lastname"
                        value={formData.lastname}
                        onChange={handleInputChange}
                        required
                    />
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
                    />
                </div>
                <div className="form-group">
                    <Label htmlFor="phone">{t("adminDashboard.agents.phone")}</Label>
                    <Input
                        id="phone"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        required
                    />
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
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setView("agents")}
                    >
                        {t("adminDashboard.actions.cancel")}
                    </Button>
                </div>
            </form>
        </motion.div>
    );
};

export default AddAgent;