// src/models/Permission.ts
interface Permission {
    permissionID: string;
    name: string;
    type: "page" | "feature"; 
    class: string; 
    description?: string;
}

export default Permission;