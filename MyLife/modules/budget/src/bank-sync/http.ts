export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface HttpRequest {
  method: HttpMethod;
  url: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}

export interface HttpResponse {
  status: number;
  headers?: Record<string, string>;
  bodyText: string;
}

export interface HttpClient {
  send(request: HttpRequest): Promise<HttpResponse>;
}
