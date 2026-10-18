"use client";
import Image from "next/image";
import { Check, Plus } from "lucide-react";
import type { Food } from "@/lib/types";
import { dollars } from "@/lib/api";
import { useShop } from "./providers";
export default function FoodCard({
  food,
  onSelect,
  aboveFold = false,
}: {
  food: Food;
  onSelect: (food: Food) => void;
  aboveFold?: boolean;
}) {
  const { cart } = useShop();
  const added = cart.some((i) => i.food._id === food._id);
  return (
    <article className="food-card">
      <div className="food-card-photo">
        <button
          onClick={() => onSelect(food)}
          className="food-image-button"
          aria-label={`View ${food.foodName}`}
        >
          <Image
            src={food.image}
            unoptimized={
              food.image.startsWith("https://") ||
              food.image.startsWith("/api/uploads/")
            }
            alt={food.foodName}
            width={600}
            height={400}
            className="food-image"
            loading={aboveFold ? "eager" : "lazy"}
          />
        </button>
        <button
          type="button"
          onClick={() => onSelect(food)}
          aria-label={`Add ${food.foodName} to cart`}
          className={`food-add ${added ? "is-added" : ""}`}
        >
          {added ? <Check size={17} /> : <Plus size={18} />}
        </button>
      </div>
      <div className="food-name-row">
        <button className="food-name" onClick={() => onSelect(food)}>
          {food.foodName}
        </button>
        <span>{dollars(food.price)}</span>
      </div>
      <p>{food.ingredients}</p>
    </article>
  );
}
