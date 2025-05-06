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
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-3xl mx-auto"
        >
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">
                {t("adminDashboard.agents.addAgent")}
            </h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label htmlFor="name" className="text-gray-700 dark:text-gray-300">
                        {t("adminDashboard.agents.name")}
                    </Label>
                    <Input
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        required
                        className="border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="lastname" className="text-gray-700 dark:text-gray-300">
                        {t("adminDashboard.agents.lastname")}
                    </Label>
                    <Input
                        id="lastname"
                        name="lastname"
                        value={formData.lastname}
                        onChange={handleInputChange}
                        required
                        className="border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="email" className="text-gray-700 dark:text-gray-300">
                        {t("adminDashboard.agents.email")}
                    </Label>
                    <Input
                        id="email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        required
                        className="border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="phone" className="text-gray-700 dark:text-gray-300">
                        {t("adminDashboard.agents.phone")}
                    </Label>
                    <Input
                        id="phone"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        required
                        className="border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="region" className="text-gray-700 dark:text-gray-300">
                        {t("adminDashboard.agents.region")}
                    </Label>
                    <Select onValueChange={(value) => setSelectedRegion(value)} value={selectedRegion}>
                        <SelectTrigger className="border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100">
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
                <div className="space-y-2">
                    <Label htmlFor="governorate" className="text-gray-700 dark:text-gray-300">
                        {t("adminDashboard.agents.governorate")}
                    </Label>
                    <Select
                        onValueChange={(value) => setSelectedGovernorate(value)}
                        value={selectedGovernorate}
                        disabled={!selectedRegion}
                    >
                        <SelectTrigger className="border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100">
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
                <div className="space-y-2">
                    <Label htmlFor="delegationID" className="text-gray-700 dark:text-gray-300">
                        {t("adminDashboard.agents.delegation")}
                    </Label>
                    <Select
                        onValueChange={(value) => handleSelectChange("delegationID", value)}
                        value={formData.delegationID}
                        disabled={!selectedGovernorate}

                    >
                        <SelectTrigger className="border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100">
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
                <div className="space-y-2">
                    <Label htmlFor="supervisorID" className="text-gray-700 dark:text-gray-300">
                        {t("adminDashboard.agents.supervisor")}
                    </Label>
                    <Select
                        onValueChange={(value) => handleSelectChange("supervisorID", value)}
                        value={formData.supervisorID}
                        disabled={!formData.delegationID}

                    >
                        <SelectTrigger className="border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100">
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
                <div className="col-span-1 md:col-span-2 flex justify-end gap-4 mt-4">
                    <Button
                        type="submit"
                        disabled={loading}
                        className="bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-500 dark:hover:bg-blue-600"
                    >
                        {loading ? t("adminDashboard.loading") : t("adminDashboard.actions.submit")}
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => setView("agents")}
                        className="border-gray-300 dark:border-gray-600 dark:text-gray-100"
                    >
                        {t("adminDashboard.actions.cancel")}
                    </Button>
                </div>
            </form>
        </motion.div>
    );
};

export default AddAgent;