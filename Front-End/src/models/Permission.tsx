// src/models/Permission.ts
interface Permission {
    permissionID: string;
    name: string;
    type: "page" | "feature"; // From your backend permission seeding
    class: string; 
    description?: string;
}

export default Permission;