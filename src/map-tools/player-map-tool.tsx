import * as React from "react";
import { useGesture } from "react-use-gesture";
import { MapTool } from "./map-tool";
import { MarkAreaToolContext } from "./mark-area-map-tool";
import { usePinchWheelZoom } from "./drag-pan-zoom-map-tool";

export const useMarkArea = () => {
  const markAreaContext = React.useContext(MarkAreaToolContext);
  const timeoutRef = React.useRef<null | (() => void)>(null);

  const init = (point: [number, number]) => {
    const timeout = setTimeout(() => {
      markAreaContext.onMarkArea(point);
    }, 300);
    timeoutRef.current = () => clearTimeout(timeout);
  };

  const cancel = () => {
    timeoutRef.current?.();
  };

  React.useEffect(() => cancel, []);

  return [init, cancel] as const;
};

export const PlayerMapTool: MapTool = {
  id: "player-map-tool",
  Component: (props) => {
    usePinchWheelZoom(props.mapContext);
    const [initMarkArea, cancelMarkArea] = useMarkArea();
    const tapRef = React.useRef<{
      point: THREE.Vector3;
      time: number;
      clientX: number;
      clientY: number;
    } | null>(null);

    props.useMapGesture({
      onPointerUp: ({ event }) => {
        cancelMarkArea();
        const tap = tapRef.current;
        tapRef.current = null;
        // clique rápido no espelho (?controle) centraliza aquele ponto
        if (
          tap &&
          Date.now() - tap.time < 250 &&
          Math.hypot(event.clientX - tap.clientX, event.clientY - tap.clientY) <
            5 &&
          new URLSearchParams(window.location.search).has("controle")
        ) {
          const position = props.mapContext.mapState.position.get();
          props.mapContext.setMapState({
            position: [position[0] - tap.point.x, position[1] - tap.point.y, 0],
          });
        }
      },
      onPointerDown: ({ event }) => {
        const point: THREE.Vector3 = event.point;
        tapRef.current = {
          point: point.clone(),
          time: Date.now(),
          clientX: event.clientX,
          clientY: event.clientY,
        };
        const [x, y] = props.mapContext.helper.threePointToImageCoordinates([
          point.x,
          point.y,
        ]);
        initMarkArea([x, y]);
      },
      onDrag: ({ movement, memo, event, tap }) => {
        if (tap) {
          return;
        }
        cancelMarkArea();
        event.stopPropagation();
        memo = memo ?? props.mapContext.mapState.position.get();
        props.mapContext.setMapState({
          position: [
            memo[0] + movement[0] / props.mapContext.viewport.factor,
            memo[1] - movement[1] / props.mapContext.viewport.factor,
            0,
          ],
          immediate: true,
        });

        return memo;
      },
    });
    useGesture(
      {
        onPinch: () => {
          cancelMarkArea();
        },
      },
      {
        domTarget: window.document,
        eventOptions: {
          passive: false,
        },
      }
    );
    return null;
  },
};
