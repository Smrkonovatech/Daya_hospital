import * as React from "react";
import CallDetailClient from "./call-detail-client";
import { callsService } from "@/lib/services/calls-service";

interface PageProps {
  params: Promise<{ callId: string }>;
}

export async function generateStaticParams() {
  const result = await callsService.getCalls({ limit: 50 });
  return result.calls.map((c) => ({
    callId: c.id,
  }));
}

async function CallDetailLoader({ params }: PageProps) {
  const { callId } = await params;
  return <CallDetailClient callId={callId} />;
}

export default function CallDetailPage({ params }: PageProps) {
  return (
    <React.Suspense
      fallback={
        <div className="p-8 text-center text-xs text-slate-500">
          Loading call session...
        </div>
      }
    >
      <CallDetailLoader params={params} />
    </React.Suspense>
  );
}
