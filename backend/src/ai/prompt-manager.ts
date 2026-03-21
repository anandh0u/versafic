import { logger } from "../utils/logger";

interface PromptTemplate {
  name: string;
  version: string;
  template: string;
  description: string;
}

class PromptManager {
  private prompts: Map<string, PromptTemplate[]> = new Map();

  register(
    name: string,
    version: string,
    template: string,
    description: string = "",
  ): void {
    const existing = this.prompts.get(name) ?? [];
    existing.push({ name, version, template, description });
    this.prompts.set(name, existing);
    logger.debug("Prompt template registered", { name, version });
  }

  get(
    name: string,
    variables?: Record<string, string>,
    version?: string,
  ): string {
    const templates = this.prompts.get(name);
    if (!templates || templates.length === 0) {
      throw new Error(`Prompt template "${name}" not found`);
    }

    let template: PromptTemplate | undefined;
    if (version) {
      template = templates.find((t) => t.version === version);
    }
    // Fall back to latest version
    if (!template) {
      template = templates[templates.length - 1];
    }
    if (!template) {
      throw new Error(
        `Prompt template "${name}" version "${version ?? "latest"}" not found`,
      );
    }

    let result = template.template;
    if (variables) {
      for (const [key, value] of Object.entries(variables)) {
        result = result.replaceAll(`{{${key}}}`, value);
      }
    }

    return result;
  }

  listPrompts(): Array<{ name: string; versions: string[] }> {
    const list: Array<{ name: string; versions: string[] }> = [];
    for (const [name, templates] of this.prompts.entries()) {
      list.push({ name, versions: templates.map((t) => t.version) });
    }
    return list;
  }
}

export const promptManager = new PromptManager();

// Register default prompts
promptManager.register(
  "customer_service",
  "1.0",
  `You are a professional customer service AI assistant for {{business_name}}.
Your role is to help customers with their queries politely and efficiently.
Business type: {{business_type}}
Business description: {{business_description}}

Guidelines:
- Be polite, professional, and helpful
- Answer only questions related to the business
- If you don't know something, say so honestly
- Keep responses concise and actionable

Customer query: {{query}}`,
  "Default customer service prompt",
);

promptManager.register(
  "intent_detection",
  "1.0",
  `Analyze the following customer message and determine the intent.
Possible intents: greeting, inquiry, complaint, booking, feedback, general, unknown.

Message: "{{message}}"

Respond with JSON: {"intent": "<intent>", "confidence": <0-1>, "entities": []}`,
  "Intent detection prompt",
);

promptManager.register(
  "data_extraction",
  "1.0",
  `Extract structured data from the following text.
Text: "{{text}}"

Extract: name, email, phone, date, time, location, and any other relevant fields.
Respond with JSON containing only the fields found.`,
  "Data extraction prompt",
);

promptManager.register(
  "chat",
  "1.0",
  `You are a helpful AI assistant. Respond thoughtfully and concisely.

{{system_context}}

User: {{message}}`,
  "General chat prompt",
);
