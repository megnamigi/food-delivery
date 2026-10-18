"use client";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import {
  Plus,
  Pencil,
  Trash2,
  ImagePlus,
  X,
  ChevronsUpDown,
  Check,
  Undo2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useShop } from "@/components/providers";
import { api, dollars } from "@/lib/api";
import type { Food, FoodCategory } from "@/lib/types";
import { useAdminPreview } from "./admin-frame";
type Editor = { food?: Food; category: string };
type Undo = { food: Food; token?: string; expiresAt: number };
export function FoodMenuDashboard({ preview = false }: { preview?: boolean }) {
  const shop = useShop(),
    sample = useAdminPreview();
  const foods = preview ? sample.foods : shop.foods,
    categories = preview ? sample.categories : shop.categories;
  const [filter, setFilter] = useState("all"),
    [editor, setEditor] = useState<Editor | null>(null),
    [categoryModal, setCategoryModal] = useState(false),
    [undo, setUndo] = useState<Undo | null>(null),
    [undoBusy, setUndoBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(
      () => setUndo(null),
      Math.max(0, undo.expiresAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [undo]);
  const reloadMenu = async () => {
    setError("");
    try {
      await shop.refreshCatalog();
    } catch (e) {
      setError(`Could not reload the menu. ${(e as Error).message}`);
    }
  };
  const save = async (data: Omit<Food, "_id">, food?: Food) => {
    if (preview) {
      if (food)
        sample.setFoods((rows) =>
          rows.map((row) =>
            row._id === food._id ? { ...data, _id: food._id } : row,
          ),
        );
      else
        sample.setFoods((rows) => [
          ...rows,
          {
            ...data,
            _id: crypto.randomUUID().replaceAll("-", "").slice(0, 24),
          },
        ]);
    } else {
      await api(food ? `/food/${food._id}` : "/food", {
        method: food ? "PATCH" : "POST",
        body: JSON.stringify(data),
      });
    }
    setEditor(null);
    shop.notify(
      food
        ? "Dish information updated."
        : "New dish has been added to the menu.",
    );
    if (!preview) await reloadMenu();
  };
  const remove = async (food: Food) => {
    let token: string | undefined;
    if (preview)
      sample.setFoods((rows) => rows.filter((row) => row._id !== food._id));
    else {
      const result = await api<{ undoToken: string }>(`/food/${food._id}`, {
        method: "DELETE",
      });
      token = result.undoToken;
    }
    setEditor(null);
    setUndo({ food, token, expiresAt: Date.now() + 60000 });
    setError("");
    if (!preview) await reloadMenu();
  };
  const restore = async () => {
    if (!undo) return;
    setUndoBusy(true);
    setError("");
    try {
      if (preview) sample.setFoods((rows) => [...rows, undo.food]);
      else {
        await api(`/food/${undo.food._id}/restore`, {
          method: "POST",
          body: JSON.stringify({ undoToken: undo.token }),
        });
      }
      setUndo(null);
      shop.notify("Dish restored.");
      if (!preview) await reloadMenu();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUndoBusy(false);
    }
  };
  const shown = categories.filter((c) => filter === "all" || c._id === filter);
  return (
    <>
      {undo && (
        <div className="admin-undo" role="status">
          <div>
            <b>Dish successfully deleted.</b>
            <p>Would you like to undo this action?</p>
          </div>
          <button disabled={undoBusy} onClick={() => void restore()}>
            <Undo2 size={15} />
            {undoBusy ? "Restoring…" : "Undo"}
          </button>
          <button
            aria-label="Dismiss undo"
            disabled={undoBusy}
            onClick={() => setUndo(null)}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="admin-error">
          {error}
          {!preview && <button onClick={() => void reloadMenu()}>Retry</button>}
        </p>
      )}
      {!preview && shop.serverAvailable === false && (
        <p className="admin-error" role="alert">
          The API is unavailable. Menu changes need a server connection.
        </p>
      )}
      <section className="admin-category-panel">
        <h1>Dishes category</h1>
        <div className="admin-category-chips">
          <button
            aria-pressed={filter === "all"}
            onClick={() => setFilter("all")}
          >
            All Dishes<span>{foods.length}</span>
          </button>
          {categories.map((c) => (
            <button
              key={c._id}
              aria-pressed={filter === c._id}
              onClick={() => setFilter(c._id)}
            >
              {c.categoryName}
              <span>{foods.filter((f) => f.category === c._id).length}</span>
            </button>
          ))}
          <button
            className="admin-add-category"
            aria-label="Add new category"
            onClick={() => setCategoryModal(true)}
          >
            <Plus size={18} />
          </button>
        </div>
      </section>
      {shown.map((category) => {
        const rows = foods.filter((f) => f.category === category._id);
        return (
          <section className="admin-food-section" key={category._id}>
            <h2>
              {category.categoryName} <span>({rows.length})</span>
            </h2>
            <div className="admin-food-grid">
              <button
                className="admin-add-dish"
                onClick={() => setEditor({ category: category._id })}
              >
                <span>
                  <Plus size={20} />
                </span>
                <span>
                  Add new Dish to
                  <br />
                  {category.categoryName}
                </span>
              </button>
              {rows.map((food) => (
                <article className="admin-food-card" key={food._id}>
                  <div className="admin-card-photo">
                    <img src={food.image} alt={food.foodName} loading="lazy" />
                    <button
                      aria-label={`Edit ${food.foodName}`}
                      onClick={() =>
                        setEditor({ food, category: food.category })
                      }
                    >
                      <Pencil size={17} />
                    </button>
                  </div>
                  <div className="admin-card-title">
                    <h3>{food.foodName}</h3>
                    <span>{dollars(food.price)}</span>
                  </div>
                  <p>{food.ingredients}</p>
                </article>
              ))}
            </div>
          </section>
        );
      })}
      {!shown.length && (
        <section className="admin-food-section">
          <p>No categories yet. Add a category to start your menu.</p>
        </section>
      )}
      <Dialog
        open={!!editor}
        onOpenChange={(open) => {
          if (!open) setEditor(null);
        }}
      >
        {editor && (
          <DishEditor
            key={editor.food?._id || editor.category}
            editor={editor}
            categories={categories}
            preview={preview}
            save={save}
            remove={remove}
          />
        )}
      </Dialog>
      <Dialog open={categoryModal} onOpenChange={setCategoryModal}>
        {categoryModal && (
          <CategoryEditor
            categories={categories}
            save={async (name) => {
              if (preview)
                sample.setCategories((rows) => [
                  ...rows,
                  {
                    _id: crypto.randomUUID().replaceAll("-", "").slice(0, 24),
                    categoryName: name,
                  },
                ]);
              else {
                await api("/food-category", {
                  method: "POST",
                  body: JSON.stringify({ categoryName: name }),
                });
              }
              setCategoryModal(false);
              shop.notify("New category has been added to the menu.");
              if (!preview) await reloadMenu();
            }}
          />
        )}
      </Dialog>
    </>
  );
}
const dishSchema = Yup.object({
  foodName: Yup.string().trim().required("Enter a dish name.").max(100),
  category: Yup.string().required("Choose a category."),
  ingredients: Yup.string().trim().required("List the ingredients.").max(1000),
  price: Yup.number()
    .typeError("Enter a valid price.")
    .required("Enter a price.")
    .moreThan(0, "Price must be greater than zero.")
    .max(10000)
    .test(
      "cents",
      "Use up to two decimal places.",
      (n) => n === undefined || Math.abs(n * 100 - Math.round(n * 100)) < 1e-7,
    ),
  image: Yup.string().required("Choose a food image."),
});
function DishEditor({
  editor,
  categories,
  preview,
  save,
  remove,
}: {
  editor: Editor;
  categories: FoodCategory[];
  preview: boolean;
  save: (data: Omit<Food, "_id">, food?: Food) => Promise<void>;
  remove: (food: Food) => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null),
    [error, setError] = useState(""),
    [reading, setReading] = useState(false),
    [deleting, setDeleting] = useState(false),
    [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const categoryName =
    categories.find((c) => c._id === editor.category)?.categoryName || "menu";
  const form = useFormik({
    initialValues: {
      foodName: editor.food?.foodName || "",
      category: editor.category,
      ingredients: editor.food?.ingredients || "",
      price: editor.food ? String(editor.food.price) : "",
      image: editor.food?.image || "",
    },
    validationSchema: dishSchema,
    onSubmit: async (values) => {
      setError("");
      try {
        let image = values.image;
        if (file && !preview) {
          const data = new FormData();
          data.append("image", file);
          image = (
            await api<{ image: string }>("/uploads", {
              method: "POST",
              body: data,
            })
          ).image;
        }
        await save(
          {
            ...values,
            foodName: values.foodName.trim(),
            ingredients: values.ingredients.trim(),
            price: Number(values.price),
            image,
          },
          editor.food,
        );
      } catch (e) {
        setError((e as Error).message);
      }
    },
  });
  const busy = form.isSubmitting || deleting || reading;
  const loadFile = async (selected?: File) => {
    if (!selected || busy) return;
    setError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(selected.type)) {
      setError("Choose a JPG, PNG, or WebP image.");
      return;
    }
    if (selected.size > 5 * 1024 * 1024) {
      setError("Image must be smaller than 5 MB.");
      return;
    }
    setReading(true);
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Image could not be read."));
        reader.readAsDataURL(selected);
      });
      setFile(selected);
      await form.setFieldValue("image", data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setReading(false);
    }
  };
  const field = (
    name: "foodName" | "ingredients" | "price" | "image" | "category",
  ) =>
    form.touched[name] && form.errors[name] ? (
      <small className="admin-field-error">{form.errors[name]}</small>
    ) : null;
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void loadFile(e.dataTransfer.files[0]);
  };
  return (
    <DialogContent
      closeDisabled={busy}
      className={`admin-modal admin-dish-modal ${editor.food ? "admin-edit-modal" : ""}`}
      onEscapeKeyDown={(e) => {
        if (busy) e.preventDefault();
      }}
      onPointerDownOutside={(e) => {
        if (busy) e.preventDefault();
      }}
    >
      <DialogTitle>
        {editor.food ? "Dishes info" : `Add new Dish to ${categoryName}`}
      </DialogTitle>
      <DialogDescription className="sr-only">
        {editor.food
          ? "Edit dish name, category, ingredients, price and image."
          : "Enter the new dish details and choose a food image."}
      </DialogDescription>
      <form onSubmit={form.handleSubmit} noValidate>
        <fieldset disabled={busy} className="admin-dish-fields">
          <div className="admin-name-field">
            <label htmlFor="foodName">
              {editor.food ? "Dish name" : "Food name"}
            </label>
            <div>
              <input
                id="foodName"
                {...form.getFieldProps("foodName")}
                placeholder="Type food name"
                maxLength={100}
                aria-invalid={!!(form.touched.foodName && form.errors.foodName)}
              />
              {field("foodName")}
            </div>
          </div>
          {editor.food && (
            <div className="admin-category-field">
              <label>Dish category</label>
              <div>
                <Dropdown.Root>
                  <Dropdown.Trigger
                    className="admin-category-select"
                    aria-label="Dish category"
                  >
                    <span>
                      {
                        categories.find((c) => c._id === form.values.category)
                          ?.categoryName
                      }
                    </span>
                    <ChevronsUpDown size={14} />
                  </Dropdown.Trigger>
                  <Dropdown.Portal>
                    <Dropdown.Content
                      className="admin-dropdown admin-category-dropdown"
                      sideOffset={6}
                    >
                      {categories.map((c) => (
                        <Dropdown.Item
                          key={c._id}
                          onSelect={() =>
                            void form.setFieldValue("category", c._id)
                          }
                        >
                          {c.categoryName}
                          {form.values.category === c._id && (
                            <Check size={14} />
                          )}
                        </Dropdown.Item>
                      ))}
                    </Dropdown.Content>
                  </Dropdown.Portal>
                </Dropdown.Root>
                {field("category")}
              </div>
            </div>
          )}
          <div className="admin-price-field">
            <label htmlFor="price">
              {editor.food ? "Price" : "Food price"}
            </label>
            <div>
              <input
                id="price"
                inputMode="decimal"
                type="number"
                min="0.01"
                max="10000"
                step="0.01"
                {...form.getFieldProps("price")}
                placeholder="Enter price…"
                aria-invalid={!!(form.touched.price && form.errors.price)}
              />
              {field("price")}
            </div>
          </div>
          <div className="admin-ingredients-field">
            <label htmlFor="ingredients">Ingredients</label>
            <div>
              <textarea
                id="ingredients"
                {...form.getFieldProps("ingredients")}
                placeholder="List ingredients…"
                rows={3}
                maxLength={1000}
                aria-invalid={
                  !!(form.touched.ingredients && form.errors.ingredients)
                }
              />
              {field("ingredients")}
            </div>
          </div>
          <div className="admin-image-field">
            <label htmlFor="dish-image">
              {editor.food ? "Image" : "Food image"}
            </label>
            <div>
              <input
                ref={input}
                className="sr-only"
                type="file"
                id="dish-image"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => void loadFile(e.target.files?.[0])}
              />
              {form.values.image ? (
                <div className="admin-image-preview">
                  <img src={form.values.image} alt="Selected food" />
                  <button
                    type="button"
                    aria-label="Remove food image"
                    onClick={() => {
                      setFile(null);
                      void form.setFieldValue("image", "");
                      if (input.current) input.current.value = "";
                    }}
                  >
                    <X size={17} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className={`admin-upload-zone ${dragging ? "dragging" : ""}`}
                  onClick={() => input.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                >
                  <ImagePlus size={22} />
                  <span>
                    {reading
                      ? "Reading image…"
                      : "Choose a file or drag & drop it here"}
                  </span>
                  <small>JPG, PNG or WebP · up to 5 MB</small>
                </button>
              )}
              {field("image")}
            </div>
          </div>
        </fieldset>
        {error && (
          <p className="admin-error" role="alert">
            {error}
          </p>
        )}
        <div className="admin-modal-footer">
          {editor.food && (
            <button
              type="button"
              className="admin-delete-button"
              disabled={busy}
              aria-label="Delete dish"
              onClick={async () => {
                setDeleting(true);
                setError("");
                try {
                  await remove(editor.food!);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setDeleting(false);
                }
              }}
            >
              <Trash2 size={17} />
            </button>
          )}
          <button type="submit" className="admin-button" disabled={busy}>
            {form.isSubmitting
              ? "Saving…"
              : deleting
                ? "Deleting…"
                : editor.food
                  ? "Save changes"
                  : "Add Dish"}
          </button>
        </div>
      </form>
    </DialogContent>
  );
}
function CategoryEditor({
  categories,
  save,
}: {
  categories: FoodCategory[];
  save: (name: string) => Promise<void>;
}) {
  const [error, setError] = useState("");
  const form = useFormik({
    initialValues: { name: "" },
    validate: (values) => {
      const name = values.name.trim();
      return !name
        ? { name: "Enter a category name." }
        : name.length > 80
          ? { name: "Use up to 80 characters." }
          : categories.some(
                (c) => c.categoryName.toLowerCase() === name.toLowerCase(),
              )
            ? { name: "This category already exists." }
            : {};
    },
    onSubmit: async (values) => {
      setError("");
      try {
        await save(values.name.trim());
      } catch (e) {
        setError((e as Error).message);
      }
    },
  });
  return (
    <DialogContent
      closeDisabled={form.isSubmitting}
      onEscapeKeyDown={(e) => {
        if (form.isSubmitting) e.preventDefault();
      }}
      onPointerDownOutside={(e) => {
        if (form.isSubmitting) e.preventDefault();
      }}
      className="admin-modal admin-category-modal"
    >
      <DialogTitle>Add new category</DialogTitle>
      <DialogDescription className="sr-only">
        Create a category to organize your dishes.
      </DialogDescription>
      <form onSubmit={form.handleSubmit} noValidate>
        <label htmlFor="categoryName">Category name</label>
        <input
          autoFocus
          id="categoryName"
          placeholder="Type category name…"
          maxLength={80}
          {...form.getFieldProps("name")}
          disabled={form.isSubmitting}
        />
        {form.touched.name && form.errors.name && (
          <small className="admin-field-error">{form.errors.name}</small>
        )}
        {error && (
          <p className="admin-error" role="alert">
            {error}
          </p>
        )}
        <div className="admin-modal-footer">
          <button
            className="admin-button"
            type="submit"
            disabled={form.isSubmitting}
          >
            {form.isSubmitting ? "Adding…" : "Add category"}
          </button>
        </div>
      </form>
    </DialogContent>
  );
}
