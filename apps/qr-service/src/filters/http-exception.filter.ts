import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import { Response } from "express";

function normalizeErrorName(status: number) {
  if (status === HttpStatus.BAD_REQUEST) return "bad_request";
  if (status === HttpStatus.UNAUTHORIZED) return "unauthorized";
  if (status === HttpStatus.FORBIDDEN) return "forbidden";
  if (status === HttpStatus.NOT_FOUND) return "not_found";
  if (status === HttpStatus.TOO_MANY_REQUESTS) return "rate_limited";
  return "http_error";
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = isHttpException ? exception.getResponse() : null;
    host.switchToHttp().getRequest().apiError = body && typeof body === "object" && "error" in body ? String(body.error) : normalizeErrorName(status);
    if (!isHttpException) console.error("Unhandled API exception", exception);

    if (body && typeof body === "object" && "error" in body && "message" in body) {
      return response.status(status).json({
        error: /^[a-z][a-z0-9_]*$/.test(String((body as { error: unknown }).error)) ? String((body as { error: unknown }).error) : normalizeErrorName(status),
        message: Array.isArray((body as { message: unknown }).message)
          ? (body as { message: string[] }).message.join("; ")
          : String((body as { message: unknown }).message)
      });
    }

    if (typeof body === "string") {
      return response.status(status).json({ error: normalizeErrorName(status), message: body });
    }

    if (body && typeof body === "object" && "message" in body) {
      const message = (body as { message: unknown }).message;
      return response.status(status).json({
        error: normalizeErrorName(status),
        message: Array.isArray(message) ? message.join("; ") : String(message)
      });
    }

    return response.status(status).json({
      error: "internal_server_error",
      message: "Internal server error"
    });
  }
}
