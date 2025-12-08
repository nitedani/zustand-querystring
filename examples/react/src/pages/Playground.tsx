import { useMemo, useRef, useEffect, useState } from "react";
import { create, StoreApi, UseBoundStore } from "zustand";
import {
  querystring,
  compact,
  QueryStringFormat,
} from "zustand-querystring";
import { createFormat as createPlainFormat } from "zustand-querystring/format/plain";
import { createFormat as createCompactFormat } from "zustand-querystring/format/compact";
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

// Settings store - persisted under "settings" key in compact format
interface SettingsState {
  format: "compact" | "plain";
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
  // Compact format options
  compactOptions: {
    typeObject: string;
    typeArray: string;
    typeString: string;
    typePrimitive: string;
    separator: string;
    terminator: string;
    escapeChar: string;
    datePrefix: string;
  };
  setFormat: (v: "compact" | "plain") => void;
  setMode: (v: "namespaced" | "standalone") => void;
  setPrefix: (v: string) => void;
  setPlainOptions: (v: Partial<SettingsState["plainOptions"]>) => void;
  setCompactOptions: (v: Partial<SettingsState["compactOptions"]>) => void;
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

const defaultCompactOptions = {
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
      format: "compact",
      mode: "standalone",
      prefix: "",
      plainOptions: defaultPlainOptions,
      compactOptions: defaultCompactOptions,
      setFormat: (format) => set({ format }),
      setMode: (mode) => set({ mode }),
      setPrefix: (prefix) => set({ prefix }),
      setPlainOptions: (opts) =>
        set((s) => ({ plainOptions: { ...s.plainOptions, ...opts } })),
      setCompactOptions: (opts) =>
        set((s) => ({ compactOptions: { ...s.compactOptions, ...opts } })),
    }),
    {
      format: compact,
      key: "settings",
      select: () => ({
        format: true,
        mode: true,
        prefix: true,
        plainOptions: true,
        compactOptions: true,
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

type FormatType = "compact" | "plain";
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
  const { format: formatType, mode, prefix, plainOptions, compactOptions } = settings;
  const [formatError, setFormatError] = useState<string | null>(null);
  const lastValidFormatRef = useRef<QueryStringFormat>(compact);

  const format = useMemo(() => {
    try {
      let newFormat: QueryStringFormat;
      if (formatType === "compact") {
        newFormat = createCompactFormat(compactOptions);
      } else {
        newFormat = createPlainFormat(plainOptions);
      }
      lastValidFormatRef.current = newFormat;
      setFormatError(null);
      return newFormat;
    } catch (err) {
      setFormatError(err instanceof Error ? err.message : String(err));
      return lastValidFormatRef.current;
    }
  }, [formatType, plainOptions, compactOptions]);

  // Store the last known good state to restore after format/mode change
  const savedStateRef = useRef<{
    search: string;
    count: number;
    enabled: boolean;
    tags: string[];
    filters: { category: string; minPrice: number; maxPrice: number };
  }>({ ...initialState, tags: [], filters: { ...initialState.filters } });
  const prevConfigRef = useRef({ formatType, mode, prefix, plainOptions, compactOptions });
  const prevStoreRef = useRef<UseBoundStore<StoreApi<PlaygroundState>> | null>(
    null
  );

  const useStore = useMemo(() => {
    const configChanged =
      prevConfigRef.current.formatType !== formatType ||
      prevConfigRef.current.mode !== mode ||
      prevConfigRef.current.prefix !== prefix ||
      JSON.stringify(prevConfigRef.current.plainOptions) !== JSON.stringify(plainOptions) ||
      JSON.stringify(prevConfigRef.current.compactOptions) !== JSON.stringify(compactOptions);

    // If config changed, reset the OLD store first to clear URL
    if (configChanged && prevStoreRef.current) {
      prevStoreRef.current.getState().reset();
    }

    // Now create new store (URL is clean)
    const store = createPlaygroundStore(format, mode, prefix);
    prevStoreRef.current = store;

    if (configChanged) {
      prevConfigRef.current = { formatType, mode, prefix, plainOptions, compactOptions };
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
  }, [format, formatType, mode, prefix, plainOptions, compactOptions]);

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
      <div>
        <Title order={1} mb="xs">
          Playground
        </Title>
        <Text c="dimmed">
          Experiment with different formats and modes. Watch how the URL changes
          as you modify state.
        </Text>
      </div>

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
              onChange={(v) => settings.setFormat(v as "compact" | "plain")}
              data={[
                { label: "Compact", value: "compact" },
                { label: "Plain", value: "plain" },
              ]}
              fullWidth
            />
            <Text size="xs" c="dimmed" mt="xs">
              {formatType === "compact"
                ? "Type markers, minimal size"
                : "Dot notation, human-readable"}
            </Text>
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
            <Text size="xs" c="dimmed" mt="xs">
              {mode === "standalone"
                ? "Each field is a URL param"
                : "All state in one param"}
            </Text>
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
            <Text size="xs" c="dimmed" mt="xs">
              Optional prefix for all params
            </Text>
          </div>
        </Group>

        <Divider my="md" label={`${formatType === "compact" ? "Compact" : "Plain"} Format Options`} labelPosition="left" />
        
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
                value={compactOptions.typeObject}
                onChange={(e) => settings.setCompactOptions({ typeObject: e.target.value })}
                size="xs"
                error={!compactOptions.typeObject}
              />
              <TextInput
                label="Type Array"
                value={compactOptions.typeArray}
                onChange={(e) => settings.setCompactOptions({ typeArray: e.target.value })}
                size="xs"
                error={!compactOptions.typeArray}
              />
              <TextInput
                label="Type String"
                value={compactOptions.typeString}
                onChange={(e) => settings.setCompactOptions({ typeString: e.target.value })}
                size="xs"
                error={!compactOptions.typeString}
              />
              <TextInput
                label="Type Primitive"
                value={compactOptions.typePrimitive}
                onChange={(e) => settings.setCompactOptions({ typePrimitive: e.target.value })}
                size="xs"
                error={!compactOptions.typePrimitive}
              />
            </Group>
            <Group grow align="flex-start" mt="sm">
              <TextInput
                label="Separator"
                value={compactOptions.separator}
                onChange={(e) => settings.setCompactOptions({ separator: e.target.value })}
                size="xs"
                error={!compactOptions.separator}
              />
              <TextInput
                label="Terminator"
                value={compactOptions.terminator}
                onChange={(e) => settings.setCompactOptions({ terminator: e.target.value })}
                size="xs"
                error={!compactOptions.terminator}
              />
              <TextInput
                label="Escape Char"
                value={compactOptions.escapeChar}
                onChange={(e) => settings.setCompactOptions({ escapeChar: e.target.value })}
                size="xs"
                error={!compactOptions.escapeChar}
              />
              <TextInput
                label="Date Prefix"
                value={compactOptions.datePrefix}
                onChange={(e) => settings.setCompactOptions({ datePrefix: e.target.value })}
                size="xs"
                error={!compactOptions.datePrefix}
              />
            </Group>
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
                const search = decodeURI(window.location.search);
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
            const formatImport = formatType === "compact" 
              ? "import { createFormat } from 'zustand-querystring/format/compact';"
              : "import { createFormat } from 'zustand-querystring/format/plain';";
            
            const hasCustomCompactOptions = formatType === "compact" && (
              compactOptions.typeObject !== "." ||
              compactOptions.typeArray !== "@" ||
              compactOptions.typeString !== "=" ||
              compactOptions.typePrimitive !== ":" ||
              compactOptions.separator !== "," ||
              compactOptions.terminator !== "~" ||
              compactOptions.escapeChar !== "/" ||
              compactOptions.datePrefix !== "D"
            );
            
            const hasCustomPlainOptions = formatType === "plain" && (
              plainOptions.entrySeparator !== "," ||
              plainOptions.nestingSeparator !== "." ||
              plainOptions.escapeChar !== "/" ||
              plainOptions.nullString !== "null" ||
              plainOptions.undefinedString !== "undefined" ||
              plainOptions.emptyArrayMarker !== "__empty__"
            );
            
            const needsCreateFormat = hasCustomCompactOptions || hasCustomPlainOptions;
            
            let formatConfig = "";
            if (needsCreateFormat) {
              if (formatType === "compact") {
                const opts: string[] = [];
                if (compactOptions.typeObject !== ".") opts.push(`  typeObject: "${compactOptions.typeObject}"`);
                if (compactOptions.typeArray !== "@") opts.push(`  typeArray: "${compactOptions.typeArray}"`);
                if (compactOptions.typeString !== "=") opts.push(`  typeString: "${compactOptions.typeString}"`);
                if (compactOptions.typePrimitive !== ":") opts.push(`  typePrimitive: "${compactOptions.typePrimitive}"`);
                if (compactOptions.separator !== ",") opts.push(`  separator: "${compactOptions.separator}"`);
                if (compactOptions.terminator !== "~") opts.push(`  terminator: "${compactOptions.terminator}"`);
                if (compactOptions.escapeChar !== "/") opts.push(`  escapeChar: "${compactOptions.escapeChar}"`);
                if (compactOptions.datePrefix !== "D") opts.push(`  datePrefix: "${compactOptions.datePrefix}"`);
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
