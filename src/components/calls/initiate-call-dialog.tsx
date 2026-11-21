"use client";

import * as React from "react";
import { PhoneOutgoing, Loader2, CheckCircle2, AlertCircle, User, Stethoscope } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

interface InitiateCallDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCallInitiated?: (callSid: string, details: { toNumber: string; patientName: string }) => void;
}

export function InitiateCallDialog({ isOpen, onClose, onCallInitiated }: InitiateCallDialogProps) {
  const { showToast } = useToast();
  const [phoneNumber, setPhoneNumber] = React.useState("");
  const [patientName, setPatientName] = React.useState("");
  const [purpose, setPurpose] = React.useState<string>("APPOINTMENT_REMINDER");
  const [doctorName, setDoctorName] = React.useState("");
  const [scheduledSlot, setScheduledSlot] = React.useState("");

  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [successSid, setSuccessSid] = React.useState<string | null>(null);

  const cleanDigits = phoneNumber.replace(/\D/g, "");
  const isValidPhone = cleanDigits.length === 10 || (cleanDigits.length === 12 && cleanDigits.startsWith("91"));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidPhone) {
      setError("Please enter a valid 10-digit Indian mobile number.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/calls/outbound", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          toNumber: cleanDigits.slice(-10),
          patientName: patientName.trim() || "Valued Patient",
          purpose,
          doctorName: doctorName.trim() || undefined,
          scheduledSlot: scheduledSlot.trim() || undefined,
        }),
      });

      const data = (await res.json()) as {
        success: boolean;
        callSid?: string;
        error?: string;
      };

      if (!res.ok || !data.success) {
        throw new Error(data.error || `Failed to initiate call (HTTP ${res.status})`);
      }

      const sid = data.callSid || `exo_${Date.now()}`;
      setSuccessSid(sid);
      showToast({
        type: "success",
        title: "AI Call Dispatched via Exotel",
        message: `Exotel Call SID: ${sid}. Connected to Flow 1393239.`,
      });

      if (onCallInitiated) {
        onCallInitiated(sid, {
          toNumber: cleanDigits.slice(-10),
          patientName: patientName.trim() || "Valued Patient",
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initiate outbound call");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setPhoneNumber("");
    setPatientName("");
    setDoctorName("");
    setScheduledSlot("");
    setPurpose("APPOINTMENT_REMINDER");
    setError(null);
    setSuccessSid(null);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Initiate AI Telephone Call via Exotel" maxWidth="md">
      {successSid ? (
        <div className="py-6 px-4 text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-slate-900">Call Dispatched Successfully</h3>
            <p className="text-xs text-slate-500">
              Exotel is currently dialing the patient. Once answered, the Smrkomed Voicebot will execute the Daya Hospital Malayalam conversation flow.
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3 border border-slate-200 text-xs font-mono text-slate-700">
            <span className="text-slate-400">Exotel Call SID: </span>
            <span className="font-semibold text-[#0C5DB8]">{successSid}</span>
          </div>
          <div className="pt-2 flex justify-center gap-2">
            <Button variant="outline" size="sm" onClick={handleReset}>
              Make Another Call
            </Button>
            <Button size="sm" onClick={handleClose}>
              Return to Ledger
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {error && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">
              Patient Mobile Number <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-xs font-medium text-slate-400">+91</span>
              <input
                type="tel"
                required
                placeholder="94471 23456"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-11 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:border-[#0C5DB8] focus:outline-none focus:ring-1 focus:ring-[#0C5DB8]"
              />
            </div>
            <p className="text-[11px] text-slate-400">Domestic 10-digit Indian mobile number.</p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">Patient Full Name</label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="e.g. Suresh Kumar"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:border-[#0C5DB8] focus:outline-none focus:ring-1 focus:ring-[#0C5DB8]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">Call Purpose</label>
              <select
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white py-1.5 px-2.5 text-xs text-slate-800 focus:border-[#0C5DB8] focus:outline-none focus:ring-1 focus:ring-[#0C5DB8]"
              >
                <option value="APPOINTMENT_REMINDER">Appointment Reminder</option>
                <option value="DOCTOR_RESCHEDULE_NOTICE">Doctor Reschedule Notice</option>
                <option value="POST_OP_FOLLOW_UP">Post-Op Follow-Up</option>
                <option value="LAB_REPORT_READY">Lab Report Ready</option>
                <option value="GENERAL_TELEPHONY_TEST">Telephony Flow Test</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">Consulting Doctor</label>
              <div className="relative">
                <Stethoscope className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="e.g. Dr. Ramesh (Cardiology)"
                  value={doctorName}
                  onChange={(e) => setDoctorName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-2.5 text-xs text-slate-800 placeholder-slate-400 focus:border-[#0C5DB8] focus:outline-none focus:ring-1 focus:ring-[#0C5DB8]"
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-blue-50/70 border border-blue-100 p-2.5 text-[11px] text-blue-700">
            <strong>Exotel Flow Target:</strong> App ID <code className="font-mono font-semibold">1393239</code> via ExoPhone <code className="font-mono font-semibold">08047291658</code>. Connected to Sarvam Malayalam Voicebot.
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={handleClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isLoading || !isValidPhone}
              className="bg-[#0C5DB8] hover:bg-[#0A4D9A] text-white gap-1.5"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Connecting Exotel...</span>
                </>
              ) : (
                <>
                  <PhoneOutgoing className="w-3.5 h-3.5" />
                  <span>Initiate AI Call</span>
                </>
              )}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
