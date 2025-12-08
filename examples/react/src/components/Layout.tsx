import { Outlet, NavLink, useLocation } from "react-router-dom";
import {
  AppShell,
  Group,
  Title,
  Anchor,
  Code,
  Text,
  Container,
  Box,
  Button,
} from "@mantine/core";

const navItems = [
  { label: "Overview", path: "/" },
  { label: "Playground", path: "/playground" },
  { label: "Format Comparison", path: "/formats" },
];

export function Layout() {
  const location = useLocation();

  return (
    <AppShell
      header={{ height: 60 }}
      footer={{ height: 50 }}
      padding="md"
    >
      <AppShell.Header>
        <Container size="xl" h="100%">
          <Group h="100%" justify="space-between">
            <Group gap="xs">
              <Title order={4}>zustand-querystring</Title>
              <Code>demo</Code>
            </Group>
            <Group gap="xs">
              {navItems.map((item) => (
                <Button
                  key={item.path}
                  component={NavLink}
                  to={item.path}
                  variant={location.pathname === item.path ? "filled" : "subtle"}
                  size="sm"
                >
                  {item.label}
                </Button>
              ))}
            </Group>
          </Group>
        </Container>
      </AppShell.Header>

      <AppShell.Main>
        <Container size="xl" py="md">
          <Outlet />
        </Container>
      </AppShell.Main>

      <AppShell.Footer>
        <Container size="xl" h="100%">
          <Group justify="space-between" h="100%">
            <Text size="sm" c="dimmed">
              URL: <Code>{location.pathname}{location.search}</Code>
            </Text>
            <Anchor
              href="https://github.com/nitedani/zustand-querystring"
              target="_blank"
              size="sm"
            >
              GitHub
            </Anchor>
          </Group>
        </Container>
      </AppShell.Footer>
    </AppShell>
  );
}
