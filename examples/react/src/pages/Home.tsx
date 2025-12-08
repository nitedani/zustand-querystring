import {
  Title,
  Text,
  Card,
  SimpleGrid,
  Code,
  List,
  Anchor,
  Stack,
  Group,
  Badge,
} from "@mantine/core";
import { Link } from "react-router-dom";

export function Home() {
  return (
    <Stack gap="xl">
      <div>
        <Title order={1} mb="xs">
          zustand-querystring
        </Title>
        <Text size="lg" c="dimmed">
          Sync Zustand state with URL query strings. Supports multiple formats,
          selective syncing, and works with any routing library.
        </Text>
      </div>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group justify="space-between" mb="xs">
            <Text fw={500}>Compact Format</Text>
            <Badge color="blue" variant="light">
              Default
            </Badge>
          </Group>
          <Text size="sm" c="dimmed" mb="md">
            Type-aware serialization with minimal URL length. Best for complex
            state with nested objects and arrays.
          </Text>
          <Code block>
            {`state=count:5,items@a,b,c~`}
          </Code>
        </Card>

        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Text fw={500} mb="xs">
            Plain Format
          </Text>
          <Text size="sm" c="dimmed" mb="md">
            Human-readable dot notation. Easy to read and manually edit. Great
            for debugging and simple state.
          </Text>
          <Code block>
            {`count=5&items=a&items=b&items=c`}
          </Code>
        </Card>

        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Text fw={500} mb="xs">
            Standalone Mode
          </Text>
          <Text size="sm" c="dimmed" mb="md">
            Each state field becomes a separate URL parameter. Perfect for
            shareable filter URLs.
          </Text>
          <Code block>
            {`?search=hello&page=1&sort=name`}
          </Code>
        </Card>
      </SimpleGrid>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Title order={3} mb="md">
          Quick Start
        </Title>
        <Code block mb="md">
          {`import { create } from "zustand";
import { querystring, compact } from "zustand-querystring";

const useStore = create(
  querystring(
    (set) => ({
      count: 0,
      increment: () => set((s) => ({ count: s.count + 1 })),
    }),
    {
      format: compact,
      select: () => ({ count: true }),
    }
  )
);`}
        </Code>
      </Card>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Title order={3} mb="md">
          Features
        </Title>
        <List spacing="sm">
          <List.Item>
            <Text span fw={500}>
              Multiple formats:
            </Text>{" "}
            Choose between compact (type-aware) or plain (human-readable)
          </List.Item>
          <List.Item>
            <Text span fw={500}>
              Selective sync:
            </Text>{" "}
            Choose which state fields to sync, with route-based control
          </List.Item>
          <List.Item>
            <Text span fw={500}>
              Type preservation:
            </Text>{" "}
            Numbers, booleans, dates, arrays, and nested objects
          </List.Item>
          <List.Item>
            <Text span fw={500}>
              Multiple stores:
            </Text>{" "}
            Use prefixes to avoid conflicts between stores
          </List.Item>
          <List.Item>
            <Text span fw={500}>
              Framework agnostic:
            </Text>{" "}
            Works with React Router, Next.js, or any routing solution
          </List.Item>
        </List>
      </Card>

      <Group>
        <Anchor component={Link} to="/playground" fw={500}>
          Try the Playground
        </Anchor>
        <Anchor component={Link} to="/formats" fw={500}>
          Compare Formats
        </Anchor>
      </Group>
    </Stack>
  );
}
