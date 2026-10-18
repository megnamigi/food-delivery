"use client";
import { useState } from "react";
import Image from "next/image";
import { Minus, Plus } from "lucide-react";
import type { Food } from "@/lib/types";
import { dollars } from "@/lib/api";
import { useShop } from "./providers";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Button } from "./ui/button";
export function FoodDetail({
  food,
  onClose,
}: {
  food: Food | null;
  onClose: () => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const { add } = useShop();
  return (
    <Dialog
      open={!!food}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
          setQuantity(1);
        }
      }}
    >
      <DialogContent className="food-detail-dialog">
        {food && (
          <>
            <Image
              src={food.image}
              unoptimized={
                food.image.startsWith("https://") ||
                food.image.startsWith("/api/uploads/")
              }
              alt={food.foodName}
              width={600}
              height={600}
              className="detail-photo"
            />
            <div className="detail-copy">
              <DialogTitle className="detail-title">
                {food.foodName}
              </DialogTitle>
              <DialogDescription className="detail-description">
                {food.ingredients}
              </DialogDescription>
              <div className="detail-bottom">
                <div className="detail-total">
                  <small>Total price</small>
                  <b>{dollars(food.price * quantity)}</b>
                </div>
                <div className="quantity">
                  <button
                    onClick={() => setQuantity((q) => q - 1)}
                    disabled={quantity <= 1}
                    aria-label="Decrease quantity"
                  >
                    <Minus size={15} />
                  </button>
                  <span aria-live="polite">{quantity}</span>
                  <button
                    onClick={() => setQuantity((q) => q + 1)}
                    disabled={quantity >= 20}
                    aria-label="Increase quantity"
                  >
                    <Plus size={15} />
                  </button>
                </div>
              </div>
              <Button
                className="w-full rounded-full"
                onClick={() => {
                  add(food, quantity);
                  setQuantity(1);
                }}
              >
                Add to cart
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
