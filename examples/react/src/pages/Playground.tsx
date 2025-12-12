import { useMemo, useRef, useEffect, useState } from "react";
import { create, StoreApi, UseBoundStore } from "zustand";
import {
  querystring,
  QueryStringFormat,
} from "zustand-querystring";
import { marked, createFormat as createMarkedFormat } from "zustand-querystring/format/marked";
import { createFormat as createPlainFormat } from "zustand-querystring/format/plain";
import { json } from "zustand-querystring/format/json";
import {
  Title,
  Text,
  Card,
  Stack,
  Group,
  TextInput,
  Switch,
  Button,
  Code,
  SegmentedControl,
  Badge,
  Divider,
  TagsInput,
  NumberInput,
} from "@mantine/core";

// Settings store - persisted under "settings" key in marked format
interface SettingsState {
  format: "marked" | "plain" | "json";
  mode: "namespaced" | "standalone";
  prefix: string;
  // Plain format options
  plainOptions: {
    entrySeparator: string;
    nestingSeparator: string;
    arraySeparator: string;
    escapeChar: string;
    nullString: string;
    undefinedString: string;
    emptyArrayMarker: string;
  };
  // Marked format options
  markedOptions: {
    typeObject: string;
    typeArray: string;
    typeString: string;
    typePrimitive: string;
    separator: string;
    terminator: string;
    escapeChar: string;
    datePrefix: string;
  };
  setFormat: (v: "marked" | "plain" | "json") => void;
  setMode: (v: "namespaced" | "standalone") => void;
  setPrefix: (v: string) => void;
  setPlainOptions: (v: Partial<SettingsState["plainOptions"]>) => void;
  setMarkedOptions: (v: Partial<SettingsState["markedOptions"]>) => void;
}

const defaultPlainOptions = {
  entrySeparator: ",",
  nestingSeparator: ".",
  arraySeparator: ",",
  escapeChar: "/",
  nullString: "null",
  undefinedString: "undefined",
  emptyArrayMarker: "__empty__",
};

const defaultMarkedOptions = {
  typeObject: ".",
  typeArray: "@",
  typeString: "=",
  typePrimitive: ":",
  separator: ",",
  terminator: "~",
  escapeChar: "/",
  datePrefix: "D",
};

const useSettings = create<SettingsState>()(
  querystring(
    (set) => ({
      format: "marked",
      mode: "standalone",
      prefix: "",
      plainOptions: defaultPlainOptions,
      markedOptions: defaultMarkedOptions,
      setFormat: (format) => set({ format }),
      setMode: (mode) => set({ mode }),
      setPrefix: (prefix) => set({ prefix }),
      setPlainOptions: (opts) =>
        set((s) => ({ plainOptions: { ...s.plainOptions, ...opts } })),
      setMarkedOptions: (opts) =>
        set((s) => ({ markedOptions: { ...s.markedOptions, ...opts } })),
    }),
    {
      format: marked,
      key: "settings",
      select: () => ({
        format: true,
        mode: true,
        prefix: true,
        plainOptions: true,
        markedOptions: true,
      }),
    }
  )
);

// Playground state store - format/mode/prefix controlled by settings
interface PlaygroundState {
  // Primitives
  search: string;
  count: number;
  enabled: boolean;
  // Complex types
  tags: string[];
  filters: {
    category: string;
    minPrice: number;
    maxPrice: number;
  };
  // Actions
  setSearch: (v: string) => void;
  setCount: (v: number) => void;
  setEnabled: (v: boolean) => void;
  setTags: (v: string[]) => void;
  setCategory: (v: string) => void;
  setMinPrice: (v: number) => void;
  setMaxPrice: (v: number) => void;
  reset: () => void;
}

const initialState = {
  search: "",
  count: 0,
  enabled: false,
  tags: [],
  filters: {
    category: "",
    minPrice: 0,
    maxPrice: 1000,
  },
};

type FormatType = "marked" | "plain" | "json";
type ModeType = "namespaced" | "standalone";

function createPlaygroundStore(
  format: QueryStringFormat,
  mode: ModeType,
  prefix: string
): UseBoundStore<StoreApi<PlaygroundState>> {
  return create<PlaygroundState>()(
    querystring(
      (set) => ({
        ...initialState,
        setSearch: (search) => set({ search }),
        setCount: (count) => set({ count }),
        setEnabled: (enabled) => set({ enabled }),
        setTags: (tags) => set({ tags }),
        setCategory: (category) =>
          set((s) => ({ filters: { ...s.filters, category } })),
        setMinPrice: (minPrice) =>
          set((s) => ({ filters: { ...s.filters, minPrice } })),
        setMaxPrice: (maxPrice) =>
          set((s) => ({ filters: { ...s.filters, maxPrice } })),
        reset: () => set(initialState),
      }),
      {
        format,
        key: mode === "namespaced" ? "state" : false,
        prefix,
        select: () => ({
          search: true,
          count: true,
          enabled: true,
          tags: true,
          filters: true,
        }),
      }
    )
  );
}

export function Playground() {
  const settings = useSettings();
  const { format: formatType, mode, prefix, plainOptions, markedOptions } = settings;
  const [formatError, setFormatError] = useState<string | null>(null);
  const lastValidFormatRef = useRef<QueryStringFormat>(marked);

  const format = useMemo(() => {
    try {
      let newFormat: QueryStringFormat;
      if (formatType === "marked") {
        newFormat = createMarkedFormat(markedOptions);
      } else if (formatType === "plain") {
        newFormat = createPlainFormat(plainOptions);
      } else {
        newFormat = json;
      }
      lastValidFormatRef.current = newFormat;
      setFormatError(null);
      return newFormat;
    } catch (err) {
      setFormatError(err instanceof Error ? err.message : String(err));
      return lastValidFormatRef.current;
    }
  }, [formatType, plainOptions, markedOptions]);

  // Store the last known good state to restore after format/mode change
  const savedStateRef = useRef<{
    search: string;
    count: number;
    enabled: boolean;
    tags: string[];
    filters: { category: string; minPrice: number; maxPrice: number };
  }>({ ...initialState, tags: [], filters: { ...initialState.filters } });
  const prevConfigRef = useRef({ formatType, mode, prefix, plainOptions, markedOptions });
  const prevStoreRef = useRef<UseBoundStore<StoreApi<PlaygroundState>> | null>(
    null
  );

  const useStore = useMemo(() => {
    const configChanged =
      prevConfigRef.current.formatType !== formatType ||
      prevConfigRef.current.mode !== mode ||
      prevConfigRef.current.prefix !== prefix ||
      JSON.stringify(prevConfigRef.current.plainOptions) !== JSON.stringify(plainOptions) ||
      JSON.stringify(prevConfigRef.current.markedOptions) !== JSON.stringify(markedOptions);

    // If config changed, reset the OLD store first to clear URL
    if (configChanged && prevStoreRef.current) {
      prevStoreRef.current.getState().reset();
    }

    // Now create new store (URL is clean)
    const store = createPlaygroundStore(format, mode, prefix);
    prevStoreRef.current = store;

    if (configChanged) {
      prevConfigRef.current = { formatType, mode, prefix, plainOptions, markedOptions };
      // Restore saved state
      const s = savedStateRef.current;
      store.setState({
        search: s.search,
        count: s.count,
        enabled: s.enabled,
        tags: [...s.tags],
        filters: { ...s.filters },
      });
    }

    return store;
  }, [format, formatType, mode, prefix, plainOptions, markedOptions]);

  const state = useStore();

  // Save current state whenever it changes
  useEffect(() => {
    savedStateRef.current = {
      search: state.search,
      count: state.count,
      enabled: state.enabled,
      tags: state.tags,
      filters: state.filters,
    };
  }, [state.search, state.count, state.enabled, state.tags, state.filters]);

  const stateSnapshot = {
    search: state.search,
    count: state.count,
    enabled: state.enabled,
    tags: state.tags,
    filters: state.filters,
  };

  return (
    <Stack gap="xl">
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group justify="space-between" align="center" mb="md">
          <Title order={4}>Configuration</Title>
          {formatError && (
            <Text size="sm" c="red" fw={500}>
              ⚠ {formatError}
            </Text>
          )}
        </Group>
        <Group grow align="flex-start">
          <div>
            <Text size="sm" fw={500} mb="xs">
              Format
            </Text>
            <SegmentedControl
              value={formatType}
              onChange={(v) => settings.setFormat(v as "marked" | "plain" | "json")}
              data={[
                { label: "Marked", value: "marked" },
                { label: "Plain", value: "plain" },
                { label: "JSON", value: "json" },
              ]}
              fullWidth
            />
          </div>
          <div>
            <Text size="sm" fw={500} mb="xs">
              Mode
            </Text>
            <SegmentedControl
              value={mode}
              onChange={(v) =>
                settings.setMode(v as "namespaced" | "standalone")
              }
              data={[
                { label: "Standalone", value: "standalone" },
                { label: "Namespaced", value: "namespaced" },
              ]}
              fullWidth
            />
          </div>
          <div>
            <Text size="sm" fw={500} mb="xs">
              Prefix
            </Text>
            <TextInput
              value={prefix}
              onChange={(e) => settings.setPrefix(e.target.value)}
              placeholder="e.g., app_"
            />
          </div>
        </Group>

        {formatType !== "json" && (
          <>
            <Divider my="md" label={`${formatType === "marked" ? "Marked" : "Plain"} Options`} labelPosition="left" />
            
            {formatType === "plain" ? (
              <>
                <Group grow align="flex-start">
              <TextInput
                label="Entry Separator"
                value={plainOptions.entrySeparator}
                onChange={(e) => settings.setPlainOptions({ entrySeparator: e.target.value })}
                size="xs"
                error={!plainOptions.entrySeparator}
              />
              <TextInput
                label="Nesting Separator"
                value={plainOptions.nestingSeparator}
                onChange={(e) => settings.setPlainOptions({ nestingSeparator: e.target.value })}
                size="xs"
                error={!plainOptions.nestingSeparator}
              />
              <TextInput
                label="Escape Char"
                value={plainOptions.escapeChar}
                onChange={(e) => settings.setPlainOptions({ escapeChar: e.target.value })}
                size="xs"
                error={!plainOptions.escapeChar}
              />
              <TextInput
                label="Array Separator"
                value={plainOptions.arraySeparator}
                onChange={(e) => settings.setPlainOptions({ arraySeparator: e.target.value })}
                size="xs"
                error={!plainOptions.arraySeparator}
              />
            </Group>
            <Group grow align="flex-start" mt="sm">
              <TextInput
                label="Null String"
                value={plainOptions.nullString}
                onChange={(e) => settings.setPlainOptions({ nullString: e.target.value })}
                size="xs"
              />
              <TextInput
                label="Undefined String"
                value={plainOptions.undefinedString}
                onChange={(e) => settings.setPlainOptions({ undefinedString: e.target.value })}
                size="xs"
              />
              <TextInput
                label="Empty Array Marker"
                value={plainOptions.emptyArrayMarker}
                onChange={(e) => settings.setPlainOptions({ emptyArrayMarker: e.target.value })}
                size="xs"
              />
            </Group>
          </>
        ) : (
          <>
            <Group grow align="flex-start">
              <TextInput
                label="Type Object"
                value={markedOptions.typeObject}
                onChange={(e) => settings.setMarkedOptions({ typeObject: e.target.value })}
                size="xs"
                error={!markedOptions.typeObject}
              />
              <TextInput
                label="Type Array"
                value={markedOptions.typeArray}
                onChange={(e) => settings.setMarkedOptions({ typeArray: e.target.value })}
                size="xs"
                error={!markedOptions.typeArray}
              />
              <TextInput
                label="Type String"
                value={markedOptions.typeString}
                onChange={(e) => settings.setMarkedOptions({ typeString: e.target.value })}
                size="xs"
                error={!markedOptions.typeString}
              />
              <TextInput
                label="Type Primitive"
                value={markedOptions.typePrimitive}
                onChange={(e) => settings.setMarkedOptions({ typePrimitive: e.target.value })}
                size="xs"
                error={!markedOptions.typePrimitive}
              />
            </Group>
            <Group grow align="flex-start" mt="sm">
              <TextInput
                label="Separator"
                value={markedOptions.separator}
                onChange={(e) => settings.setMarkedOptions({ separator: e.target.value })}
                size="xs"
                error={!markedOptions.separator}
              />
              <TextInput
                label="Terminator"
                value={markedOptions.terminator}
                onChange={(e) => settings.setMarkedOptions({ terminator: e.target.value })}
                size="xs"
                error={!markedOptions.terminator}
              />
              <TextInput
                label="Escape Char"
                value={markedOptions.escapeChar}
                onChange={(e) => settings.setMarkedOptions({ escapeChar: e.target.value })}
                size="xs"
                error={!markedOptions.escapeChar}
              />
              <TextInput
                label="Date Prefix"
                value={markedOptions.datePrefix}
                onChange={(e) => settings.setMarkedOptions({ datePrefix: e.target.value })}
                size="xs"
                error={!markedOptions.datePrefix}
              />
            </Group>
          </>
        )}
          </>
        )}
      </Card>

      <Group grow align="flex-start">
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group justify="space-between" mb="md">
            <Title order={4}>State Controls</Title>
            <Button variant="subtle" size="xs" onClick={state.reset}>
              Reset
            </Button>
          </Group>

          <Stack gap="md">
            <TextInput
              label="Search"
              value={state.search}
              onChange={(e) => state.setSearch(e.target.value)}
              placeholder="Type something..."
            />

            <NumberInput
              label="Count"
              value={state.count}
              onChange={(v) => state.setCount(Number(v) || 0)}
            />

            <Switch
              label="Enabled"
              checked={state.enabled}
              onChange={(e) => state.setEnabled(e.target.checked)}
            />

            <TagsInput
              label="Tags"
              value={state.tags}
              onChange={state.setTags}
              placeholder="Add tags..."
            />

            <Divider label="Nested: filters" labelPosition="left" />

            <TextInput
              label="Category"
              value={state.filters.category}
              onChange={(e) => state.setCategory(e.target.value)}
              placeholder="Enter category"
            />

            <Group grow>
              <NumberInput
                label="Min Price"
                value={state.filters.minPrice}
                onChange={(v) => state.setMinPrice(Number(v) || 0)}
                min={0}
              />
              <NumberInput
                label="Max Price"
                value={state.filters.maxPrice}
                onChange={(v) => state.setMaxPrice(Number(v) || 0)}
                min={0}
              />
            </Group>
          </Stack>
        </Card>

        <Stack gap="lg">
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Title order={4} mb="md">
              Current State
            </Title>
            <Code block style={{ whiteSpace: "pre-wrap" }}>
              {JSON.stringify(stateSnapshot, null, 2)}
            </Code>
          </Card>

          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Title order={4} mb="md">
              URL Query String
            </Title>
            <Code block style={{ wordBreak: "break-all" }}>
              {(() => {
                const search = window.location.search;
                if (!search) return "(empty)";
                const parts = search.slice(1).split("&");
                const filtered = parts.filter(
                  (p) => !p.startsWith("settings=")
                );
                return filtered.length > 0
                  ? `?${filtered.join("&")}`
                  : "(empty)";
              })()}
            </Code>
            <Group mt="md" gap="xs">
              <Badge variant="light">Format: {formatType}</Badge>
              <Badge variant="light">Mode: {mode}</Badge>
              {prefix && <Badge variant="light">Prefix: {prefix}</Badge>}
            </Group>
          </Card>
        </Stack>
      </Group>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Title order={4} mb="md">
          Configuration Code
        </Title>
        <Code block>
          {(() => {
            const formatImport = formatType === "marked" 
              ? "import { createFormat } from 'zustand-querystring/format/marked';"
              : "import { createFormat } from 'zustand-querystring/format/plain';";
            
            const hasCustomMarkedOptions = formatType === "marked" && (
              markedOptions.typeObject !== "." ||
              markedOptions.typeArray !== "@" ||
              markedOptions.typeString !== "=" ||
              markedOptions.typePrimitive !== ":" ||
              markedOptions.separator !== "," ||
              markedOptions.terminator !== "~" ||
              markedOptions.escapeChar !== "/" ||
              markedOptions.datePrefix !== "D"
            );
            
            const hasCustomPlainOptions = formatType === "plain" && (
              plainOptions.entrySeparator !== "," ||
              plainOptions.nestingSeparator !== "." ||
              plainOptions.escapeChar !== "/" ||
              plainOptions.nullString !== "null" ||
              plainOptions.undefinedString !== "undefined" ||
              plainOptions.emptyArrayMarker !== "__empty__"
            );
            
            const needsCreateFormat = hasCustomMarkedOptions || hasCustomPlainOptions;
            
            let formatConfig = "";
            if (needsCreateFormat) {
              if (formatType === "marked") {
                const opts: string[] = [];
                if (markedOptions.typeObject !== ".") opts.push(`  typeObject: "${markedOptions.typeObject}"`);
                if (markedOptions.typeArray !== "@") opts.push(`  typeArray: "${markedOptions.typeArray}"`);
                if (markedOptions.typeString !== "=") opts.push(`  typeString: "${markedOptions.typeString}"`);
                if (markedOptions.typePrimitive !== ":") opts.push(`  typePrimitive: "${markedOptions.typePrimitive}"`);
                if (markedOptions.separator !== ",") opts.push(`  separator: "${markedOptions.separator}"`);
                if (markedOptions.terminator !== "~") opts.push(`  terminator: "${markedOptions.terminator}"`);
                if (markedOptions.escapeChar !== "/") opts.push(`  escapeChar: "${markedOptions.escapeChar}"`);
                if (markedOptions.datePrefix !== "D") opts.push(`  datePrefix: "${markedOptions.datePrefix}"`);
                formatConfig = `const format = createFormat({\n${opts.join(",\n")}\n});`;
              } else {
                const opts: string[] = [];
                if (plainOptions.entrySeparator !== ",") opts.push(`  entrySeparator: "${plainOptions.entrySeparator}"`);
                if (plainOptions.nestingSeparator !== ".") opts.push(`  nestingSeparator: "${plainOptions.nestingSeparator}"`);
                if (plainOptions.escapeChar !== "/") opts.push(`  escapeChar: "${plainOptions.escapeChar}"`);
                if (plainOptions.nullString !== "null") opts.push(`  nullString: "${plainOptions.nullString}"`);
                if (plainOptions.undefinedString !== "undefined") opts.push(`  undefinedString: "${plainOptions.undefinedString}"`);
                if (plainOptions.emptyArrayMarker !== "__empty__") opts.push(`  emptyArrayMarker: "${plainOptions.emptyArrayMarker}"`);
                formatConfig = `const format = createFormat({\n${opts.join(",\n")}\n});`;
              }
            }
            
            const formatValue = needsCreateFormat ? "format" : formatType;
            
            return `import { create } from 'zustand';
import { querystring } from 'zustand-querystring';
${needsCreateFormat ? formatImport + "\n" : ""}
${formatConfig ? formatConfig + "\n\n" : ""}const useStore = create(
  querystring(
    (set) => ({ /* state */ }),
    {
      format: ${formatValue},
      key: ${mode === "namespaced" ? '"state"' : "false"},${prefix ? `\n      prefix: "${prefix}",` : ""}
      select: () => ({
        search: true,
        count: true,
        enabled: true,
        tags: true,
        filters: true,
      }),
    }
  )
);`;
          })()}
        </Code>
      </Card>
    </Stack>
  );
}
