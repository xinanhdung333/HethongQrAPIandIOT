import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import { Response } from "express";

function nameFor(status: number) {
  if (status === HttpStatus.BAD_REQUEST) return "bad_request";
  if (status === HttpStatus.UNAUTHORIZED) return "unauthorized";
  if (status === HttpStatus.FORBIDDEN) return "forbidden";
  if (status === HttpStatus.CONFLICT) return "conflict";
  return "http_error";
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : 500;
    const body = isHttp ? exception.getResponse() : null;
    if (body && typeof body === "object" && "error" in body && "message" in body) {
      return response.status(status).json({ error: String((body as { error: unknown }).error), message: String((body as { message: unknown }).message) });
    }
    const message = typeof body === "string" ? body : "Internal server error";
    return response.status(status).json({ error: nameFor(status), message });
  }
}
