export type FoodCategory = { _id: string; categoryName: string };
export type Food = {
  _id: string;
  foodName: string;
  price: number;
  image: string;
  ingredients: string;
  category: string;
};
export type CartItem = { food: Food; quantity: number };
export type User = {
  _id: string;
  email: string;
  role: "USER" | "ADMIN";
  isVerified: boolean;
  address?: string;
};
export type FoodOrder = {
  _id: string;
  totalPrice: number;
  shipping: number;
  foodOrderItems: { food: Food; quantity: number; unitPrice: number }[];
  status: "PENDING" | "CANCELED" | "DELIVERED";
  address: string;
  createdAt: string;
};
