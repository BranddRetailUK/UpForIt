"use client";

import { useEffect, useRef, useState } from "react";

type EventVideoPlayerProps = {
  src: string;
  title: string;
};

export default function EventVideoPlayer({ src, title }: EventVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [needsUserStart, setNeedsUserStart] = useState(true);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    video.muted = true;
    const playAttempt = video.play();

    if (playAttempt) {
      playAttempt
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  }, []);

  const togglePlayback = async () => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    try {
      if (needsUserStart) {
        video.muted = false;
        setNeedsUserStart(false);

        if (!video.paused && !video.ended) {
          setIsPlaying(true);
          return;
        }
      }

      if (video.paused || video.ended) {
        if (video.ended) {
          video.currentTime = 0;
        }

        await video.play();
        setIsPlaying(true);
        return;
      }

      video.pause();
      setIsPlaying(false);
    } catch {
      setIsPlaying(!video.paused);
    }
  };

  const buttonMode = needsUserStart || !isPlaying ? "play" : "pause";

  return (
    <div
      className={[
        "video-player",
        isPlaying ? "is-playing" : "",
        needsUserStart ? "needs-user-start" : ""
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <video
        ref={videoRef}
        className="video-player__media"
        aria-label={title}
        autoPlay
        controls
        muted
        playsInline
        preload="auto"
        onEnded={() => setIsPlaying(false)}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onVolumeChange={() => {
          if (!videoRef.current?.muted) {
            setNeedsUserStart(false);
          }
        }}
      >
        <source src={src} type="video/mp4" />
      </video>

      <button
        className="video-player__button"
        type="button"
        aria-label={buttonMode === "play" ? "Play video" : "Pause video"}
        onClick={togglePlayback}
      >
        <span
          className={`video-player__icon video-player__icon--${buttonMode}`}
          aria-hidden="true"
        />
      </button>
    </div>
  );
}
