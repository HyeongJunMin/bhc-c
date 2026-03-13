import * as http from 'node:http';

const DOCKER_SOCKET = '/var/run/docker.sock';

export function dockerRequest(method: string, path: string, body?: object): Promise<{ status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : undefined;
    const options: http.RequestOptions = {
      socketPath: DOCKER_SOCKET,
      method,
      path,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };

    const req = http.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => (raw += chunk));
      res.on('end', () => {
        let data: unknown = raw;
        try { data = JSON.parse(raw); } catch { /* keep raw */ }
        resolve({ status: res.statusCode ?? 0, data });
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

export async function pullImage(image: string, tag: string): Promise<void> {
  const res = await dockerRequest('POST', `/images/create?fromImage=${encodeURIComponent(image)}&tag=${encodeURIComponent(tag)}`);
  if (res.status !== 200) {
    throw new Error(`pullImage failed: status=${res.status} body=${JSON.stringify(res.data)}`);
  }
}

export async function stopContainer(name: string): Promise<void> {
  const res = await dockerRequest('POST', `/containers/${encodeURIComponent(name)}/stop`);
  if (res.status !== 204 && res.status !== 304 && res.status !== 404) {
    throw new Error(`stopContainer failed: status=${res.status} body=${JSON.stringify(res.data)}`);
  }
}

export async function removeContainer(name: string): Promise<void> {
  const res = await dockerRequest('DELETE', `/containers/${encodeURIComponent(name)}`);
  if (res.status !== 204 && res.status !== 404) {
    throw new Error(`removeContainer failed: status=${res.status} body=${JSON.stringify(res.data)}`);
  }
}

export interface ContainerConfig {
  Image: string;
  Cmd: string[];
  HostConfig: {
    Binds?: string[];
    AutoRemove?: boolean;
    RestartPolicy?: { Name: string };
    PortBindings?: Record<string, Array<{ HostPort: string }>>;
  };
  Env?: string[];
}

export async function createContainer(name: string, config: ContainerConfig): Promise<string> {
  const res = await dockerRequest('POST', `/containers/create?name=${encodeURIComponent(name)}`, config);
  if (res.status !== 201) {
    throw new Error(`createContainer failed: status=${res.status} body=${JSON.stringify(res.data)}`);
  }
  return (res.data as { Id: string }).Id;
}

export async function startContainer(name: string): Promise<void> {
  const res = await dockerRequest('POST', `/containers/${encodeURIComponent(name)}/start`);
  if (res.status !== 204 && res.status !== 304) {
    throw new Error(`startContainer failed: status=${res.status} body=${JSON.stringify(res.data)}`);
  }
}
