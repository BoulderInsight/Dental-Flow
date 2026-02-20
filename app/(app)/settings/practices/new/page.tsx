"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { toast } from "sonner";

const industries = [
  { value: "dental", label: "Dental" },
  { value: "chiropractic", label: "Chiropractic" },
  { value: "veterinary", label: "Veterinary" },
  { value: "general", label: "General" },
  { value: "other", label: "Other" },
];

export default function NewPracticePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("dental");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Practice name is required");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/practices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), industry }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to create practice");
        return;
      }

      const practice = await res.json();
      toast.success("Practice created");

      // Switch to the new practice
      const switchRes = await fetch("/api/auth/switch-practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ practiceId: practice.id }),
      });

      if (switchRes.ok) {
        window.location.href = "/";
      } else {
        router.push("/");
      }
    } catch {
      toast.error("Failed to create practice");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-bold">Add Practice</h1>
        <p className="text-muted-foreground mt-1">
          Create a new practice to manage separately.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label
            htmlFor="practice-name"
            className="text-sm font-medium"
          >
            Practice Name
          </label>
          <Input
            id="practice-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Bright Smiles Dental"
            required
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="practice-industry"
            className="text-sm font-medium"
          >
            Industry
          </label>
          <Select
            id="practice-industry"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
          >
            {industries.map((ind) => (
              <option key={ind.value} value={ind.value}>
                {ind.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating..." : "Create Practice"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
