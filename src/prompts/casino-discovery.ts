import { StateConfig } from "@/types";

export const DISCOVERY_SYSTEM_PROMPT =
  "You are a regulatory research assistant specializing in US online gambling. You provide accurate, well-sourced information about licensed online casino operators.";

export function buildDiscoveryUserPrompt(state: StateConfig): string {
  return `List all currently licensed and operational online casinos in ${state.name}. Focus on the ${state.gaming_commission} as the authoritative source. For each casino, provide the operator name, brand name, website, and license status. Only include casinos that offer online casino games (not sportsbook-only operators).`;
}

export const DISCOVERY_JSON_SCHEMA = {
  type: "object",
  properties: {
    casinos: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "Casino brand name" },
          operator: {
            type: "string",
            description: "Parent company or operator",
          },
          website: {
            type: "string",
            description: "Official website URL",
          },
          license_status: {
            type: "string",
            description: "Current license status (active, pending, etc)",
          },
        },
        required: ["name", "operator", "website", "license_status"],
      },
    },
  },
  required: ["casinos"],
};
