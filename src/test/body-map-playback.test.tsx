import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { DashboardBodyMap } from "@/components/member/DashboardBodyMap";
const motion = vi.hoisted(() => ({ moving: true }));
vi.mock("@/components/member/MemberShell", () => ({ useMemberMotion: () => motion.moving }));
const props = { zone: null, loading: false, onZoneChange: () => {} };
let play: ReturnType<typeof vi.spyOn>;
let pause: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  motion.moving = true;
  play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe("smooth rotating body playback", () => {
  it("prefers the hardware-friendly MP4 and starts muted inline playback", () => {
    const { container } = render(<DashboardBodyMap {...props} />);
    const video = container.querySelector("video")!;
    expect(video.querySelector("source")).toHaveAttribute("type", "video/mp4");
    expect(video).toHaveAttribute("preload", "auto");
    expect(video).toHaveAttribute("playsinline");
    expect(video.loop).toBe(true);
    expect(video.muted).toBe(true);
    expect(video.style.filter).toBe("none");
    expect(play).toHaveBeenCalledTimes(1);
  });
  it("recovers after an autoplay rejection when ready and on returning to the tab", async () => {
    play.mockRejectedValueOnce(new DOMException("Autoplay blocked", "NotAllowedError"));
    const { container, unmount } = render(<DashboardBodyMap {...props} />);
    await Promise.resolve();
    fireEvent.canPlay(container.querySelector("video")!);
    expect(play).toHaveBeenCalledTimes(2);
    vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    fireEvent(document, new Event("visibilitychange"));
    expect(pause).toHaveBeenCalledTimes(1);
    vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    fireEvent(document, new Event("visibilitychange"));
    expect(play).toHaveBeenCalledTimes(3);
    unmount();
    fireEvent(window, new Event("pageshow"));
    expect(play).toHaveBeenCalledTimes(3);
  });
  it("respects reduced motion and restarts when motion is enabled", () => {
    motion.moving = false;
    const { container, rerender } = render(<DashboardBodyMap {...props} />);
    fireEvent.canPlay(container.querySelector("video")!);
    fireEvent.pointerDown(window);
    expect(play).not.toHaveBeenCalled();
    motion.moving = true;
    rerender(<DashboardBodyMap {...props} />);
    expect(play).toHaveBeenCalledTimes(1);
  });
});
