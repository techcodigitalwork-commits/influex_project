/* ================= USER ROLES ================= */

export enum UserRole {
  INFLUENCER = "INFLUENCER",
  MODEL = "MODEL",
  PHOTOGRAPHER = "PHOTOGRAPHER",
  BRAND = "BRAND",
  ADMIN = "ADMIN",
}

/* ================= CAMPAIGN STATUS ================= */

export enum CampaignStatus {
  OPEN = "OPEN",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

/* ================= SOCIAL LINKS ================= */

export interface SocialLinks {
  instagram?: string;
  youtube?: string;
  twitter?: string;
  linkedin?: string;
}

/* ================= USER PROFILE ================= */

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  avatar: string;
  city: string;
  category: string;
  budgetRange: string;
  followers?: number;
  rating: number;
  reviewCount: number;
  bio: string;
  socials: SocialLinks;
  verified: boolean;
}

/* ================= CAMPAIGN ================= */

export interface Campaign {
  id: string;
  brandId: string;
  brandName: string;
  title: string;
  description: string;
  budget: string;
  category: string;
  requiredRoles: UserRole[];
  status: CampaignStatus;
  deadline: string;
}

/* ================= MESSAGE ================= */

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  text: string;
  timestamp: string;
}
