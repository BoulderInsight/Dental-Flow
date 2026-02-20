"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const INDUSTRY_OPTIONS = [
  { value: "dental", label: "Dental Practice" },
  { value: "chiropractic", label: "Chiropractic Office" },
  { value: "veterinary", label: "Veterinary Clinic" },
  { value: "general", label: "General Small Business" },
  { value: "other", label: "Other" },
];

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [practiceName, setPracticeName] = useState("");
  const [industry, setIndustry] = useState("dental");
  const [customIndustry, setCustomIndustry] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          practiceName,
          industry: industry === "other" ? "other" : industry,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create account");
        setLoading(false);
        return;
      }

      // Auto sign-in after signup
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      // If "Other" was selected, generate a custom industry config after signup
      if (industry === "other" && customIndustry.trim()) {
        try {
          await fetch("/api/industry/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ industryName: customIndustry.trim() }),
          });
        } catch {
          // Non-critical — industry generation can be retried later
        }
      }

      setLoading(false);

      if (result?.error) {
        setError("Account created. Please sign in.");
        router.push("/login");
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("Something went wrong");
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">
          <span className="text-primary">DentalFlow</span>{" "}
          <span className="text-muted-foreground text-sm font-normal">Pro</span>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Create your account
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              Your Name
            </label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Dr. Smith"
              required
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="practiceName" className="text-sm font-medium">
              Practice Name
            </label>
            <Input
              id="practiceName"
              value={practiceName}
              onChange={(e) => setPracticeName(e.target.value)}
              placeholder="Sunny Valley Dental"
              required
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="industry" className="text-sm font-medium">
              Industry
            </label>
            <Select
              id="industry"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
            >
              {INDUSTRY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>
          {industry === "other" && (
            <div className="space-y-2">
              <label htmlFor="customIndustry" className="text-sm font-medium">
                Describe Your Business Type
              </label>
              <Input
                id="customIndustry"
                value={customIndustry}
                onChange={(e) => setCustomIndustry(e.target.value)}
                placeholder="e.g. Optometry Practice, Plumbing Company"
                required
              />
            </div>
          )}
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@practice.com"
              required
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              required
              minLength={8}
            />
          </div>
          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating account..." : "Create Account"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
