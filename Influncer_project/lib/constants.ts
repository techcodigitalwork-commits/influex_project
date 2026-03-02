import { UserRole, UserProfile, Campaign, CampaignStatus } from "@/lib/types";

export const CITIES = [
  "Mumbai",
  "Delhi",
  "Bangalore",
  "Hyderabad",
  "Chennai",
  "Pune",
  "Kolkata",
  "Ahmedabad",
];

export const CATEGORIES = [
  "Fashion",
  "Tech",
  "Lifestyle",
  "Food",
  "Travel",
  "Fitness",
  "Automotive",
];

export const MOCK_USERS: UserProfile[] = [
  {
    id: "1",
    name: "Ananya Sharma",
    role: UserRole.INFLUENCER,
    avatar: "https://picsum.photos/seed/ananya/200",
    city: "Mumbai",
    category: "Fashion",
    budgetRange: "₹10k - ₹50k",
    followers: 250000,
    rating: 4.8,
    reviewCount: 42,
    bio: "Fashion enthusiast and lifestyle vlogger based in Mumbai. Creating content that inspires.",
    socials: {
      instagram: "@ananya_style",
      youtube: "AnanyaVlogs",
    },
    verified: true,
  },
  {
    id: "2",
    name: "Vikram Malhotra",
    role: UserRole.PHOTOGRAPHER,
    avatar: "https://picsum.photos/seed/vikram/200",
    city: "Delhi",
    category: "Lifestyle",
    budgetRange: "₹15k - ₹30k",
    rating: 4.9,
    reviewCount: 88,
    bio: "Professional fashion photographer with 5+ years of experience in high-end editorial shoots.",
    socials: {
      instagram: "@vikram_lens",
    },
    verified: true,
  },
  {
    id: "3",
    name: "Rohan Gupta",
    role: UserRole.MODEL,
    avatar: "https://picsum.photos/seed/rohan/200",
    city: "Bangalore",
    category: "Fitness",
    budgetRange: "₹20k - ₹40k",
    rating: 4.7,
    reviewCount: 24,
    bio: "Fitness model and athlete. Collaborated with top sportswear brands.",
    socials: {
      instagram: "@rohan_fit",
    },
    verified: false,
  },
  {
    id: "4",
    name: "Sneha Kapur",
    role: UserRole.INFLUENCER,
    avatar: "https://picsum.photos/seed/sneha/200",
    city: "Pune",
    category: "Tech",
    budgetRange: "₹50k - ₹100k",
    followers: 1200000,
    rating: 4.6,
    reviewCount: 156,
    bio: "Unboxing the future. Tech reviewer and gadget enthusiast.",
    socials: {
      youtube: "SnehaTech",
    },
    verified: true,
  },
];

export const MOCK_CAMPAIGNS: Campaign[] = [
  {
    id: "c1",
    brandId: "b1",
    brandName: "Ziva Fashion",
    title: "Summer Collection 2024 Launch",
    description:
      "Looking for 5 lifestyle influencers and 2 photographers for our upcoming summer collection shoot in Goa.",
    budget: "₹2,00,000",
    category: "Fashion",
    requiredRoles: [UserRole.INFLUENCER, UserRole.PHOTOGRAPHER],
    status: CampaignStatus.OPEN,
    deadline: "2024-05-15",
  },
  {
    id: "c2",
    brandId: "b2",
    brandName: "TechNova",
    title: "Smartphone X Review",
    description:
      "Tech influencers needed for an exclusive unboxing and review of the new TechNova X series.",
    budget: "₹50,000 per post",
    category: "Tech",
    requiredRoles: [UserRole.INFLUENCER],
    status: CampaignStatus.IN_PROGRESS,
    deadline: "2024-04-20",
  },
];
