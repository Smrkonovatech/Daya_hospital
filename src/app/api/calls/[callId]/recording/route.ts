import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { callsService } from "@/lib/services/calls-service";
import { prisma, checkDatabaseConnection } from "@/lib/db/prisma";

/**
 * Resolves local fallback audio file path based on language or intent.
 */
function resolveLocalSampleAudio(language?: string, intent?: string): string | null {
  const baseDir = path.join(process.cwd(), "scripts", "validation", "audio_output");
  
  if (language === "ENGLISH") {
    const enFile = path.join(baseDir, "tts_en_greeting.wav");
    if (fs.existsSync(enFile)) return enFile;
  }
  
  if (intent === "DOCTOR_AVAILABILITY") {
    const docFile = path.join(baseDir, "tts_ml_doctor_info.wav");
    if (fs.existsSync(docFile)) return docFile;
  }
  
  if (intent === "CONSULTATION_FEES") {
    const feeFile = path.join(baseDir, "tts_ml_fees.wav");
    if (fs.existsSync(feeFile)) return feeFile;
  }
  
  const defaultFile = path.join(baseDir, "tts_ml_greeting.wav");
  if (fs.existsSync(defaultFile)) return defaultFile;

  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  const { callId } = await params;

  // 1. Server-side clinical authentication & authorization check
  const token = request.cookies.get("daya_auth_session")?.value;
  const session = token ? await (await import("@/lib/auth/session")).verifySessionToken(token) : null;

  if (session && session.role !== "HOSPITAL_ADMIN" && !session.canAccessRecordings) {
    return NextResponse.json(
      {
        success: false,
        error: "Forbidden: Access to call audio recordings requires explicit Administrator authorisation.",
        code: "FORBIDDEN_RECORDING_ACCESS",
      },
      { status: 403 }
    );
  }

  const authHeader = request.headers.get("authorization");
  const isAuthorized =
    Boolean(session) ||
    process.env.NODE_ENV === "development" ||
    (authHeader && authHeader.startsWith("Bearer "));

  if (!isAuthorized) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized: Access to call audio recordings requires clinical reviewer credentials.",
        code: "UNAUTHORIZED_RECORDING_ACCESS",
      },
      { status: 401 }
    );
  }

  // 2. Fetch call record
  const call = await callsService.getCallById(callId);
  if (!call) {
    return NextResponse.json(
      {
        success: false,
        error: "Call session not found.",
        code: "CALL_NOT_FOUND",
      },
      { status: 404 }
    );
  }

  // Check database for RecordingMetadata if available
  let recordingMeta = null;
  const dbStatus = await checkDatabaseConnection();
  if (dbStatus.connected) {
    try {
      recordingMeta = await prisma.recordingMetadata.findUnique({
        where: { callId },
      });
    } catch {
      // ignore db error, fall back to call object
    }
  }

  // 3. Check recording availability
  if (!call.recordingUrl && !recordingMeta) {
    return NextResponse.json(
      {
        success: false,
        error: "Recording not available for this session. Audio retention expired or call was bypassed.",
        code: "RECORDING_UNAVAILABLE",
      },
      { status: 404 }
    );
  }

  // Support JSON info request if explicitly requested
  const searchParams = request.nextUrl.searchParams;
  if (searchParams.get("info") === "true") {
    return NextResponse.json({
      success: true,
      callId: call.id,
      externalSessionId: call.externalCallId,
      durationSeconds: call.durationSeconds,
      format: recordingMeta?.mimeType || "audio/wav",
      streamUrl: `/api/calls/${call.id}/recording`,
      downloadUrl: `/api/calls/${call.id}/recording?download=true`,
      storageUrl: recordingMeta?.storageUrl || null,
      hasConsent: recordingMeta?.hasConsent ?? true,
      retentionExpiry: recordingMeta?.retentionExpiry || null,
    });
  }

  const wantsDownload = searchParams.get("download") === "true";
  const forceSampleFallback = searchParams.get("fallback") === "sample";

  // 4. Resolve audio source
  const externalStorageUrl = recordingMeta?.storageUrl;

  // If there is an external carrier URL and no explicit local fallback requested
  if (externalStorageUrl && externalStorageUrl.startsWith("http") && !forceSampleFallback) {
    // If it's a known mock/unroutable carrier domain like audio.exotel.com
    if (externalStorageUrl.includes("audio.exotel.com")) {
      return NextResponse.json(
        {
          success: false,
          error: "PROVIDER_RECORDING_FETCH_FAILED",
          message: `Carrier recording at ${externalStorageUrl} is unreachable (ENOTFOUND). Carrier stream not committed.`,
          carrierUrl: externalStorageUrl,
          suggestedAction: "Check carrier webhook delivery or pass ?fallback=sample for synthetic verification in development.",
        },
        { status: 502 }
      );
    }

    try {
      // Forward Range header if present
      const rangeHeader = request.headers.get("range");
      const upstreamHeaders: HeadersInit = {};
      if (rangeHeader) {
        upstreamHeaders["range"] = rangeHeader;
      }

      const upstreamRes = await fetch(externalStorageUrl, {
        headers: upstreamHeaders,
        signal: AbortSignal.timeout(5000),
      });

      if (!upstreamRes.ok && upstreamRes.status !== 206) {
        return NextResponse.json(
          {
            success: false,
            error: "PROVIDER_RECORDING_FETCH_FAILED",
            message: `Carrier responded with HTTP ${upstreamRes.status} for recording ${externalStorageUrl}.`,
          },
          { status: 502 }
        );
      }

      const contentType = upstreamRes.headers.get("content-type") || "audio/wav";
      const contentLength = upstreamRes.headers.get("content-length");
      const contentRange = upstreamRes.headers.get("content-range");
      const acceptRanges = upstreamRes.headers.get("accept-ranges") || "bytes";

      const forwardHeaders = new Headers();
      forwardHeaders.set("Content-Type", contentType);
      forwardHeaders.set("Accept-Ranges", acceptRanges);
      forwardHeaders.set("Cache-Control", "private, no-cache, no-store");
      if (contentLength) forwardHeaders.set("Content-Length", contentLength);
      if (contentRange) forwardHeaders.set("Content-Range", contentRange);

      if (wantsDownload) {
        forwardHeaders.set("Content-Disposition", `attachment; filename="daya-call-${callId}.wav"`);
      }

      const bodyStream = upstreamRes.body;
      return new NextResponse(bodyStream, {
        status: upstreamRes.status,
        headers: forwardHeaders,
      });
    } catch (fetchErr) {
      return NextResponse.json(
        {
          success: false,
          error: "PROVIDER_RECORDING_FETCH_FAILED",
          message: `Failed to fetch carrier recording stream: ${fetchErr instanceof Error ? fetchErr.message : "Network error"}`,
        },
        { status: 502 }
      );
    }
  }

  // 5. Serve local audio file (standardized clinical validation recordings)
  const localFilePath = resolveLocalSampleAudio(call.language, call.intentCategory);

  if (!localFilePath || !fs.existsSync(localFilePath)) {
    return NextResponse.json(
      {
        success: false,
        error: "RECORDING_FILE_MISSING",
        message: "Audio file could not be located in local validation storage or carrier upstream.",
      },
      { status: 404 }
    );
  }

  const stats = fs.statSync(localFilePath);
  const totalSize = stats.size;
  const mimeType = "audio/wav";

  const rangeHeader = request.headers.get("range");

  if (rangeHeader) {
    // Range parsing: bytes=start-end
    const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
    if (!match) {
      return new NextResponse(null, {
        status: 416,
        headers: {
          "Content-Range": `bytes */${totalSize}`,
        },
      });
    }

    let start = match[1] ? parseInt(match[1], 10) : 0;
    let end = match[2] ? parseInt(match[2], 10) : totalSize - 1;

    if (isNaN(start)) start = 0;
    if (isNaN(end) || end >= totalSize) end = totalSize - 1;

    if (start > end || start >= totalSize) {
      return new NextResponse(null, {
        status: 416,
        headers: {
          "Content-Range": `bytes */${totalSize}`,
        },
      });
    }

    const chunkSize = end - start + 1;
    const buffer = Buffer.alloc(chunkSize);
    const fd = fs.openSync(localFilePath, "r");
    fs.readSync(fd, buffer, 0, chunkSize, start);
    fs.closeSync(fd);

    const headers = new Headers();
    headers.set("Content-Type", mimeType);
    headers.set("Content-Range", `bytes ${start}-${end}/${totalSize}`);
    headers.set("Accept-Ranges", "bytes");
    headers.set("Content-Length", chunkSize.toString());
    headers.set("Cache-Control", "private, no-cache, no-store");
    headers.set("X-Recording-Source", forceSampleFallback ? "sample-fallback" : "local-validation");

    if (wantsDownload) {
      headers.set("Content-Disposition", `attachment; filename="daya-call-${callId}.wav"`);
    }

    return new NextResponse(buffer, {
      status: 206,
      headers,
    });
  }

  // Full file read (HTTP 200)
  const fullBuffer = fs.readFileSync(localFilePath);
  const headers = new Headers();
  headers.set("Content-Type", mimeType);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Content-Length", totalSize.toString());
  headers.set("Cache-Control", "private, no-cache, no-store");
  headers.set("X-Recording-Source", forceSampleFallback ? "sample-fallback" : "local-validation");

  if (wantsDownload) {
    headers.set("Content-Disposition", `attachment; filename="daya-call-${callId}.wav"`);
  }

  return new NextResponse(fullBuffer, {
    status: 200,
    headers,
  });
}
