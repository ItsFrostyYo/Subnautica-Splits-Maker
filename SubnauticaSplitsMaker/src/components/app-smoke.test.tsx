import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../App";

describe("App", () => {
  it("renders run setup panel", () => {
    render(<App />);
    expect(screen.getByText("Run Setup")).toBeInTheDocument();
  });
});
