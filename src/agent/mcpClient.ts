import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createAgentMcpServer } from "./mcpServer";

// 별도 프로세스/전송(stdio, HTTP) 없이 같은 백엔드 프로세스 안에서
// 실제 MCP 프로토콜(list_tools, call_tool)로 서버-클라이언트가 통신하도록 In-Memory Transport로 연결한다.
// 배포 인프라를 늘리지 않으면서 MCP 표준을 그대로 지키기 위한 선택 (reply.md 참고).
let clientPromise: Promise<Client> | null = null;

async function createConnectedClient(): Promise<Client> {
  const server = createAgentMcpServer();
  const client = new Client({ name: "moving-agent-orchestrator", version: "1.0.0" });

  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  return client;
}

export function getAgentMcpClient(): Promise<Client> {
  if (!clientPromise) {
    clientPromise = createConnectedClient();
  }
  return clientPromise;
}

export type McpToolCallRecord<T = unknown> = {
  request: { name: string; arguments: Record<string, unknown> };
  response: unknown;
  result: T;
};

// MCP call_tool 요청/응답 원본 payload를 함께 반환한다 — AgentLog에 그대로 기록해
// "실제 MCP 메시지를 주고받았다"는 근거로 남기기 위함.
export async function callAgentTool<T = unknown>(
  toolName: string,
  args: Record<string, unknown>
): Promise<McpToolCallRecord<T>> {
  const client = await getAgentMcpClient();
  const request = { name: toolName, arguments: args };

  const response = await client.callTool(request);

  if (response.isError) {
    const content = response.content as Array<{ type: string; text?: string }> | undefined;
    const errorText = content?.[0]?.type === "text" ? content[0]?.text : undefined;
    throw new Error(`[MCP:${toolName}] ${errorText ?? "MCP 도구 호출 실패"}`);
  }

  return {
    request,
    response,
    result: response.structuredContent as T
  };
}
