import { useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import { Menu, MenuItem, Stack, Typography } from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { bonncoColors } from "../theme/theme";

export interface NavDropdownItem<T extends string = string> {
  id: T;
  label: string;
  icon?: ReactNode;
}

export default function NavDropdown<T extends string>({
  label,
  items,
  selectedId,
  active,
  onSelect,
  onLabelClick,
}: {
  label: string;
  items: NavDropdownItem<T>[];
  selectedId?: T;
  active: boolean;
  onSelect: (id: T) => void;
  /** When given, clicking the label text navigates (e.g. to a group overview) instead of opening
   * the menu; the menu then only opens from the chevron. Omit for a plain single-click dropdown. */
  onLabelClick?: () => void;
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  function open(e: MouseEvent<HTMLElement>) {
    setAnchorEl(e.currentTarget);
  }
  function close() {
    setAnchorEl(null);
  }
  function pick(id: T) {
    onSelect(id);
    close();
  }

  return (
    <>
      <Stack
        direction="row"
        onClick={onLabelClick ? undefined : open}
        sx={{
          alignItems: "center",
          gap: 0.4,
          cursor: onLabelClick ? "default" : "pointer",
          pl: 1.5,
          pr: onLabelClick ? 0.5 : 1.5,
          py: 0.85,
          borderRadius: 1.5,
          backgroundColor: active ? bonncoColors.bgElevated : "transparent",
          color: active ? bonncoColors.textPrimary : bonncoColors.textSecondary,
          fontWeight: 700,
          "&:hover": { backgroundColor: bonncoColors.bgElevated },
        }}
      >
        <Typography
          onClick={onLabelClick}
          sx={{ fontWeight: 700, fontSize: 14, cursor: onLabelClick ? "pointer" : "inherit" }}
        >
          {label}
        </Typography>
        <Stack
          onClick={(e) => {
            e.stopPropagation();
            open(e);
          }}
          sx={{ cursor: "pointer", p: onLabelClick ? 0.5 : 0, borderRadius: 1 }}
        >
          <KeyboardArrowDownIcon sx={{ fontSize: 18, transform: anchorEl ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
        </Stack>
      </Stack>

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={close} slotProps={{ paper: { sx: { maxHeight: 420, minWidth: 220 } } }}>
        {items.map((item) => (
          <MenuItem key={item.id} selected={active && item.id === selectedId} onClick={() => pick(item.id)}>
            {item.icon && (
              <Stack sx={{ mr: 1.25, color: bonncoColors.textSecondary, display: "flex" }}>{item.icon}</Stack>
            )}
            {item.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
