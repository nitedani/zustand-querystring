import { useState, useMemo } from "react";
import { marked } from "zustand-querystring/format/marked";
import { plain } from "zustand-querystring/format/plain";
import { json } from "zustand-querystring/format/json";
import { isEqual } from "lodash-es";
import {
  Title,
  Text,
  Card,
  Stack,
  Group,
  Code,
  Table,
  JsonInput,
  Alert,
  SegmentedControl,
  CopyButton,
  ActionIcon,
  Tooltip,
  Badge,
} from "@mantine/core";

const exampleStates = {
  simple: {
    label: "Simple",
    state: { search: "hello", count: 42, enabled: true },
  },
  arrays: {
    label: "Arrays",
    state: { tags: ["react", "typescript", "zustand"], ids: [1, 2, 3] },
  },
  nested: {
    label: "Nested",
    state: {
      user: { name: "John", age: 30 },
      settings: { theme: "dark", notifications: true },
    },
  },
  complex: {
    label: "Complex",
    state: {
      query: "search term",
      page: 1,
      filters: {
        categories: ["tech", "science"],
        price: { min: 0, max: 100 },
      },
      sort: { field: "date", order: "desc" },
    },
  },
  special: {
    label: "Special Values",
    state: {
      empty: "",
      zero: 0,
      negative: -42,
      decimal: 3.14,
      withComma: "hello, world",
      withDot: "file.txt",
    },
  },
};

type ExampleKey = keyof typeof exampleStates;

function formatOutput(
  format: typeof marked | typeof plain | typeof json,
  state: object,
  mode: "namespaced" | "standalone"
): string {
  try {
    if (mode === "namespaced") {
      return format.stringify(state);
    } else {
      const params = format.stringifyStandalone(state);
      return Object.entries(params)
        .map(([k, v]) => v.map((val) => `${k}=${val}`).join("&"))
        .join("&");
    }
  } catch (e) {
    return `Error: ${e instanceof Error ? e.message : "Unknown error"}`;
  }
}

function parseOutput(
  format: typeof marked | typeof plain | typeof json,
  input: string,
  mode: "namespaced" | "standalone",
  initialState: object
): string {
  try {
    if (mode === "namespaced") {
      const result = format.parse(input, { initialState });
      return JSON.stringify(result, null, 2);
    } else {
      const params: Record<string, string[]> = {};
      input.split("&").forEach((pair) => {
        const eqIndex = pair.indexOf("=");
        if (eqIndex === -1) return;
        const key = pair.slice(0, eqIndex);
        const value = pair.slice(eqIndex + 1);
        if (key) {
          params[key] = params[key] || [];
          params[key].push(value);
        }
      });
      const result = format.parseStandalone(params, { initialState });
      return JSON.stringify(result, null, 2);
    }
  } catch (e) {
    return `Error: ${e instanceof Error ? e.message : "Unknown error"}`;
  }
}

export function Formats() {
  const [selectedExample, setSelectedExample] = useState<ExampleKey>("simple");
  const [mode, setMode] = useState<"namespaced" | "standalone">("standalone");
  const [customJson, setCustomJson] = useState("");

  const { currentState, customError } = useMemo(() => {
    if (!customJson) {
      return { currentState: exampleStates[selectedExample].state, customError: null };
    }
    try {
      return { currentState: JSON.parse(customJson), customError: null };
    } catch {
      return { currentState: exampleStates[selectedExample].state, customError: "Invalid JSON" };
    }
  }, [customJson, selectedExample]);

  const markedOutput = formatOutput(marked, currentState, mode);
  const plainOutput = formatOutput(plain, currentState, mode);
  const jsonOutput = formatOutput(json, currentState, mode);

  const markedParsed = parseOutput(marked, markedOutput, mode, currentState);
  const plainParsed = parseOutput(plain, plainOutput, mode, currentState);
  const jsonParsed = parseOutput(json, jsonOutput, mode, currentState);

  // Check round-trip fidelity (order-insensitive)
  const markedRoundTripMatch = !markedParsed.startsWith("Error") && 
    isEqual(JSON.parse(markedParsed), currentState);
  const plainRoundTripMatch = !plainParsed.startsWith("Error") && 
    isEqual(JSON.parse(plainParsed), currentState);
  const jsonRoundTripMatch = !jsonParsed.startsWith("Error") && 
    isEqual(JSON.parse(jsonParsed), currentState);

  return (
    <Stack gap="xl">
      <Title order={1}>Format Comparison</Title>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group justify="space-between" mb="md">
          <Title order={4}>Input State</Title>
          <SegmentedControl
            value={mode}
            onChange={(v) => setMode(v as "namespaced" | "standalone")}
            data={[
              { label: "Standalone", value: "standalone" },
              { label: "Namespaced", value: "namespaced" },
            ]}
            size="xs"
          />
        </Group>

        <Group mb="md" gap="xs">
          {Object.entries(exampleStates).map(([key, { label }]) => (
            <Badge
              key={key}
              variant={selectedExample === key && !customJson ? "filled" : "light"}
              style={{ cursor: "pointer" }}
              onClick={() => {
                setSelectedExample(key as ExampleKey);
                setCustomJson("");
              }}
            >
              {label}
            </Badge>
          ))}
        </Group>

        <JsonInput
          label="Edit JSON (or select an example above)"
          value={customJson || JSON.stringify(currentState, null, 2)}
          onChange={(v) => setCustomJson(v)}
          formatOnBlur
          autosize
          minRows={20}
          error={customError}
        />
      </Card>

      <Table.ScrollContainer minWidth={800}>
        <Table striped highlightOnHover withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ width: 120 }}>Format</Table.Th>
              <Table.Th>Serialized Output</Table.Th>
              <Table.Th style={{ width: 80 }}>Length</Table.Th>
              <Table.Th style={{ width: 60 }}></Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            <Table.Tr>
              <Table.Td>
                <Text fw={500}>Marked</Text>
              </Table.Td>
              <Table.Td>
                <Code
                  block
                  style={{ wordBreak: "break-all", whiteSpace: "pre-wrap" }}
                >
                  {markedOutput}
                </Code>
              </Table.Td>
              <Table.Td>
                <Text size="sm" ta="center">
                  {markedOutput.length}
                </Text>
              </Table.Td>
              <Table.Td>
                <CopyButton value={markedOutput}>
                  {({ copied, copy }) => (
                    <Tooltip label={copied ? "Copied" : "Copy"}>
                      <ActionIcon
                        variant="subtle"
                        onClick={copy}
                        color={copied ? "teal" : "gray"}
                      >
                        {copied ? "OK" : "CP"}
                      </ActionIcon>
                    </Tooltip>
                  )}
                </CopyButton>
              </Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td>
                <Text fw={500}>Plain</Text>
              </Table.Td>
              <Table.Td>
                <Code
                  block
                  style={{ wordBreak: "break-all", whiteSpace: "pre-wrap" }}
                >
                  {plainOutput}
                </Code>
              </Table.Td>
              <Table.Td>
                <Text size="sm" ta="center">
                  {plainOutput.length}
                </Text>
              </Table.Td>
              <Table.Td>
                <CopyButton value={plainOutput}>
                  {({ copied, copy }) => (
                    <Tooltip label={copied ? "Copied" : "Copy"}>
                      <ActionIcon
                        variant="subtle"
                        onClick={copy}
                        color={copied ? "teal" : "gray"}
                      >
                        {copied ? "OK" : "CP"}
                      </ActionIcon>
                    </Tooltip>
                  )}
                </CopyButton>
              </Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td>
                <Text fw={500}>JSON</Text>
              </Table.Td>
              <Table.Td>
                <Code
                  block
                  style={{ wordBreak: "break-all", whiteSpace: "pre-wrap" }}
                >
                  {jsonOutput}
                </Code>
              </Table.Td>
              <Table.Td>
                <Text size="sm" ta="center">
                  {jsonOutput.length}
                </Text>
              </Table.Td>
              <Table.Td>
                <CopyButton value={jsonOutput}>
                  {({ copied, copy }) => (
                    <Tooltip label={copied ? "Copied" : "Copy"}>
                      <ActionIcon
                        variant="subtle"
                        onClick={copy}
                        color={copied ? "teal" : "gray"}
                      >
                        {copied ? "OK" : "CP"}
                      </ActionIcon>
                    </Tooltip>
                  )}
                </CopyButton>
              </Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      <Group grow align="flex-start">
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group justify="space-between" mb="md">
            <Title order={4}>Marked</Title>
            {!markedRoundTripMatch && (
              <Badge color="red" size="sm">Round-trip failed</Badge>
            )}
          </Group>
          <Stack gap="xs">
            <Text size="xs" c="dimmed" mt="xs">Parsed:</Text>
            <Code block style={{ fontSize: 11 }}>
              {markedParsed}
            </Code>
          </Stack>
        </Card>

        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group justify="space-between" mb="md">
            <Title order={4}>Plain</Title>
            {!plainRoundTripMatch && (
              <Badge color="red" size="sm">Round-trip failed</Badge>
            )}
          </Group>
          <Stack gap="xs">
            <Text size="xs" c="dimmed" mt="xs">Parsed:</Text>
            <Code block style={{ fontSize: 11 }}>
              {plainParsed}
            </Code>
          </Stack>
        </Card>

        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group justify="space-between" mb="md">
            <Title order={4}>JSON</Title>
            {!jsonRoundTripMatch && (
              <Badge color="red" size="sm">Round-trip failed</Badge>
            )}
          </Group>
          <Stack gap="xs">
            <Text size="xs" c="dimmed" mt="xs">Parsed:</Text>
            <Code block style={{ fontSize: 11 }}>
              {jsonParsed}
            </Code>
          </Stack>
        </Card>
      </Group>

      <Alert variant="light" color="gray" title="Modes">
        <Text size="sm">
          <Text span fw={500}>Standalone</Text> ({mode === "standalone" ? "current" : "switch above"}): Each field is a URL param.
          {" "}
          <Text span fw={500}>Namespaced</Text> ({mode === "namespaced" ? "current" : "switch above"}): All state in one param.
        </Text>
      </Alert>
    </Stack>
  );
}
