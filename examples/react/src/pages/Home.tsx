import {
  Title,
  Text,
  Card,
  Code,
  Anchor,
  Stack,
  Group,
  Table,
} from "@mantine/core";
import { Link } from "react-router-dom";

export function Home() {
  return (
    <Stack gap="xl">
      <div>
        <Title order={1} mb="xs">
          zustand-querystring
        </Title>
        <Text c="dimmed">
          Zustand middleware for syncing state with URL query strings.
        </Text>
      </div>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Title order={3} mb="md">
          Usage
        </Title>
        <Code block>
          {`import { create } from "zustand";
import { querystring } from "zustand-querystring";

const useStore = create(
  querystring(
    (set) => ({
      search: "",
      page: 1,
      setSearch: (s) => set({ search: s }),
      setPage: (p) => set({ page: p }),
    }),
    {
      select: () => ({ search: true, page: true }),
    }
  )
);
// URL: ?search=hello&page=2`}
        </Code>
      </Card>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Title order={3} mb="md">
          Formats
        </Title>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Format</Table.Th>
              <Table.Th>Example Output</Table.Th>
              <Table.Th>Notes</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            <Table.Tr>
              <Table.Td><Code>marked</Code> (default)</Table.Td>
              <Table.Td><Code>count:5,items@a,b~</Code></Table.Td>
              <Table.Td>Shortest, type markers</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td><Code>plain</Code></Table.Td>
              <Table.Td><Code>count=5&items=a,b</Code></Table.Td>
              <Table.Td>Readable, dot notation</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td><Code>json</Code></Table.Td>
              <Table.Td><Code>count=5&items=%5B%22a%22%5D</Code></Table.Td>
              <Table.Td>Longest, JSON encoded</Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>
      </Card>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Title order={3} mb="md">
          Options
        </Title>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Option</Table.Th>
              <Table.Th>Default</Table.Th>
              <Table.Th>Description</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            <Table.Tr>
              <Table.Td><Code>select</Code></Table.Td>
              <Table.Td>-</Table.Td>
              <Table.Td>Which fields to sync (can be route-based)</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td><Code>key</Code></Table.Td>
              <Table.Td><Code>false</Code></Table.Td>
              <Table.Td><Code>false</Code> = standalone params, <Code>"state"</Code> = namespaced</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td><Code>prefix</Code></Table.Td>
              <Table.Td><Code>""</Code></Table.Td>
              <Table.Td>Prefix for URL params (for multiple stores)</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td><Code>format</Code></Table.Td>
              <Table.Td><Code>marked</Code></Table.Td>
              <Table.Td>Serialization format</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td><Code>url</Code></Table.Td>
              <Table.Td>-</Table.Td>
              <Table.Td>Request URL for SSR</Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>
      </Card>

      <Group>
        <Anchor component={Link} to="/playground" fw={500}>
          Playground →
        </Anchor>
        <Anchor component={Link} to="/formats" fw={500}>
          Compare Formats →
        </Anchor>
        <Anchor href="https://github.com/nitedani/zustand-querystring" fw={500}>
          GitHub →
        </Anchor>
      </Group>
    </Stack>
  );
}
