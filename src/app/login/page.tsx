"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  UserCheck,
  Shield,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useAuth } from "@/components/auth/auth-provider";
import {
  loginSchema,
  LoginFormData,
  passwordResetSchema,
  PasswordResetFormData,
} from "@/lib/validations/auth-schema";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("from") || "/overview";

  const { login, isAuthenticated } = useAuth();

  // If already authenticated, navigate to destination
  React.useEffect(() => {
    if (isAuthenticated) {
      router.push(redirectPath);
    }
  }, [isAuthenticated, redirectPath, router]);

  const [showPassword, setShowPassword] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Forgot password modal state
  const [isResetModalOpen, setIsResetModalOpen] = React.useState(false);
  const [resetSuccessMessage, setResetSuccessMessage] = React.useState<string | null>(null);
  const [isResetting, setIsResetting] = React.useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema) as unknown as Resolver<LoginFormData>,
    defaultValues: {
      email: "admin@dayahospital.com",
      password: "DayaAdmin@2026",
    },
  });

  const {
    register: registerReset,
    handleSubmit: handleResetSubmit,
    reset: resetForgotForm,
    formState: { errors: resetErrors },
  } = useForm<PasswordResetFormData>({
    resolver: zodResolver(passwordResetSchema) as unknown as Resolver<PasswordResetFormData>,
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      const res = await login(data.email, data.password);

      if (res.success) {
        router.push(redirectPath);
        router.refresh();
      } else {
        setErrorMessage(res.error || "Invalid hospital email or password.");
      }
    } catch {
      setErrorMessage("Authentication error. Please check server connectivity.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onResetSubmit = async (data: PasswordResetFormData) => {
    try {
      setIsResetting(true);
      setResetSuccessMessage(null);
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      setResetSuccessMessage(
        json.message || "Password reset instructions have been dispatched to your hospital address."
      );
      resetForgotForm();
    } catch {
      setResetSuccessMessage("Password reset request logged. Please contact Medical Admin.");
    } finally {
      setIsResetting(false);
    }
  };

  const handleQuickFill = (role: "admin" | "staff", autoSubmit = false) => {
    const email = role === "admin" ? "admin@dayahospital.com" : "staff@dayahospital.com";
    const password = role === "admin" ? "DayaAdmin@2026" : "DayaStaff@2026";
    const opts = { shouldValidate: true, shouldDirty: true, shouldTouch: true };
    setValue("email", email, opts);
    setValue("password", password, opts);
    setErrorMessage(null);
    if (autoSubmit) {
      onSubmit({ email, password });
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-8 bg-linear-to-b from-[#F5F8FC] via-white to-[#EAF2FB]">
      <div className="w-full max-w-md space-y-6">
        {/* Hospital Branding Header */}
        <div className="text-center space-y-3">
          <div className="flex justify-center mb-1">
            <Image
              src="/logo.png"
              alt="Daya General Hospital & Speciality Surgical Centre"
              width={220}
              height={50}
              priority
              className="object-contain h-12 w-auto"
            />
          </div>

          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">
              AI Calling Operations Portal
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              Malayalam Voice Agent Grounding & Clinical Telephony Audit
            </p>
          </div>

          <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-[#0C5DB8] border border-blue-200">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>NABH Aligned Clinical Security</span>
          </div>
        </div>

        {/* Login Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-7 shadow-xs space-y-5">
          {errorMessage && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 flex items-start gap-2.5 text-xs text-red-800"
            >
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Authentication Failed</p>
                <p className="text-[11px] mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-xs">
            {/* Email Field */}
            <div>
              <label className="font-semibold text-slate-800 block mb-1">
                Hospital Email or Employee ID <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  {...register("email")}
                  type="text"
                  placeholder="e.g. admin@dayahospital.com or DGH-EMP-001"
                  autoComplete="username"
                  className={`pl-9 text-xs ${errors.email ? "border-red-400 focus:ring-red-400" : ""}`}
                />
              </div>
              {errors.email && (
                <p className="text-red-500 text-[11px] mt-1">{errors.email.message}</p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-slate-800">
                  Password <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsResetModalOpen(true)}
                  className="text-[11px] font-medium text-[#0C5DB8] hover:underline cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>

              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  {...register("password")}
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  className={`pl-9 pr-9 text-xs ${errors.password ? "border-red-400 focus:ring-red-400" : ""}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-500 text-[11px] mt-1">{errors.password.message}</p>
              )}
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#0C5DB8] hover:bg-[#0A4D98] text-white font-medium py-2 text-xs shadow-2xs gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <span>Sign In to Hospital Portal</span>
              )}
            </Button>
          </form>

          {/* Quick Demo Fill Buttons */}
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <HelpCircle className="h-3.5 w-3.5 text-slate-400" />
              <span>Select Authorized Demo Account for Testing:</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickFill("admin")}
                className="rounded-lg border border-blue-200 bg-blue-50/60 p-2 text-left hover:bg-blue-100/60 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1 text-[#0C5DB8] font-bold text-[11px]">
                  <Shield className="h-3 w-3" />
                  <span>Admin</span>
                </div>
                <p className="text-[10px] text-slate-600 truncate mt-0.5">
                  Dr. Anjali Menon
                </p>
                <p className="text-[9px] text-slate-400">Full Permissions</p>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill("staff")}
                className="rounded-lg border border-teal-200 bg-teal-50/60 p-2 text-left hover:bg-teal-100/60 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1 text-[#0E7A71] font-bold text-[11px]">
                  <UserCheck className="h-3 w-3" />
                  <span>Staff</span>
                </div>
                <p className="text-[10px] text-slate-600 truncate mt-0.5">
                  Sister Mary
                </p>
                <p className="text-[9px] text-slate-400">Call Reviewer</p>
              </button>
            </div>
          </div>
        </div>

        {/* Footer Disclaimers */}
        <div className="text-center text-[11px] text-slate-500 space-y-1">
          <p>© 2026 Daya General Hospital Ltd & Speciality Surgical Centre, Thrissur</p>
          <p className="text-slate-400 text-[10px]">
            Unauthorized access or disclosure of patient communications is prohibited under Indian Medical Council regulations and IT Act 2000.
          </p>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <Modal
        isOpen={isResetModalOpen}
        onClose={() => {
          setIsResetModalOpen(false);
          setResetSuccessMessage(null);
        }}
        maxWidth="md"
        title={
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-[#0C5DB8]" />
            <span>Reset Hospital Portal Password</span>
          </div>
        }
        description="Enter your registered Daya Hospital email address. Password reset instructions will be dispatched to your account."
      >
        <div className="space-y-4 text-xs">
          {resetSuccessMessage ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 space-y-1">
              <p className="font-semibold">Request Received</p>
              <p className="text-[11px]">{resetSuccessMessage}</p>
              <div className="pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsResetModalOpen(false)}
                  className="text-xs"
                >
                  Return to Login
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleResetSubmit(onResetSubmit)} className="space-y-3">
              <div>
                <label className="font-semibold text-slate-800 block mb-1">
                  Registered Hospital Email *
                </label>
                <Input
                  {...registerReset("email")}
                  placeholder="e.g. staff@dayahospital.com"
                  className={resetErrors.email ? "border-red-400" : ""}
                />
                {resetErrors.email && (
                  <p className="text-red-500 text-[11px] mt-1">{resetErrors.email.message}</p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsResetModalOpen(false)}
                  disabled={isResetting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isResetting}
                  className="bg-[#0C5DB8] text-white"
                >
                  {isResetting ? "Sending..." : "Send Reset Link"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </Modal>
    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#F5F8FC] text-xs text-slate-500">
          Loading Daya Hospital Authentication Portal...
        </div>
      }
    >
      <LoginContent />
    </React.Suspense>
  );
}
