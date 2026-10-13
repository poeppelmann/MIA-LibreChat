import React from 'react';
import userEvent from '@testing-library/user-event';
import { render, screen, within } from '@testing-library/react';
import { AgentCapabilities } from 'librechat-data-provider';
import ToolsDropdown from '../ToolsDropdown';

const mockDebouncedChange = jest.fn();
const mockSetIsPinned = jest.fn();

const defaultImageGeneration = {
  isPinned: false,
  toggleState: false,
  setIsPinned: mockSetIsPinned,
  debouncedChange: mockDebouncedChange,
};

let mockImageGeneration = { ...defaultImageGeneration };
let mockCapabilities: AgentCapabilities[] = [AgentCapabilities.image_generation];

jest.mock('~/Providers', () => ({
  useBadgeRowContext: () => ({
    imageGeneration: mockImageGeneration,
    agentsConfig: { capabilities: mockCapabilities },
  }),
}));

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => key,
  useHasAccess: () => true,
  useAgentCapabilities: jest.requireActual('~/hooks/Agents/useAgentCapabilities').default,
}));

jest.mock('~/data-provider', () => ({
  useGetStartupConfig: () => ({ data: undefined }),
}));

const MENU_ITEM_TEST_ID = 'tools-menu-image-generation';

async function openMenu() {
  const user = userEvent.setup();
  render(<ToolsDropdown />);
  const trigger = screen.queryByRole('button', { name: 'Tools Options' });
  if (trigger) {
    await user.click(trigger);
  }
  return user;
}

describe('ToolsDropdown image generation entry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockImageGeneration = { ...defaultImageGeneration };
    mockCapabilities = [AgentCapabilities.image_generation];
  });

  it('lists image generation when the capability is enabled', async () => {
    await openMenu();
    const item = await screen.findByTestId(MENU_ITEM_TEST_ID);
    expect(within(item).getByText('com_ui_image_gen')).toBeInTheDocument();
  });

  it('omits image generation when the capability is disabled', async () => {
    mockCapabilities = [AgentCapabilities.web_search];
    await openMenu();
    expect(screen.queryByTestId(MENU_ITEM_TEST_ID)).not.toBeInTheDocument();
  });

  it('enables the toggle when the entry is clicked', async () => {
    const user = await openMenu();
    await user.click(await screen.findByTestId(MENU_ITEM_TEST_ID));
    expect(mockDebouncedChange).toHaveBeenCalledTimes(1);
    expect(mockDebouncedChange).toHaveBeenCalledWith({ value: true });
  });

  it('disables the toggle when it is already active', async () => {
    mockImageGeneration = { ...defaultImageGeneration, toggleState: true };
    const user = await openMenu();
    await user.click(await screen.findByTestId(MENU_ITEM_TEST_ID));
    expect(mockDebouncedChange).toHaveBeenCalledWith({ value: false });
  });

  it('pins the badge without toggling the tool', async () => {
    const user = await openMenu();
    const item = await screen.findByTestId(MENU_ITEM_TEST_ID);
    await user.click(within(item).getByRole('button', { name: 'com_ui_pin' }));
    expect(mockSetIsPinned).toHaveBeenCalledWith(true);
    expect(mockDebouncedChange).not.toHaveBeenCalled();
  });

  it('offers unpin when the badge is already pinned', async () => {
    mockImageGeneration = { ...defaultImageGeneration, isPinned: true };
    const user = await openMenu();
    const item = await screen.findByTestId(MENU_ITEM_TEST_ID);
    await user.click(within(item).getByRole('button', { name: 'com_ui_unpin' }));
    expect(mockSetIsPinned).toHaveBeenCalledWith(false);
  });
});
