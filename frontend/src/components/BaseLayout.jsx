import React from "react";

/**
 * BaseLayout - Responsive mobile-first base component for all pages
 * 
 * Props:
 * - children: Main content to render
 * - headerTitle: Title displayed in header
 * - headerActions: Array of button objects {label, onClick, style?, disabled?}
 * - maxWidth: Max width of content card (default: "600px")
 * - minHeight: Min height of main area (default: "80vh")
 * - backgroundColor: Background color of overlay (default: "rgba(0,0,0,0.2)")
 * - cardStyle: Additional styles for content card
 */
export default function BaseLayout({
  children,
  headerTitle = "",
  headerActions = [],
  maxWidth = "600px",
  minHeight = "80vh",
  backgroundColor = "rgba(0,0,0,0.2)",
  cardStyle = {},
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundImage: "url('/ELTELogo.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        position: "relative",
      }}
    >
      {/* Overlay */}
      <div
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          background: backgroundColor,
          pointerEvents: "none",
        }}
      />

      <div style={{ position: "relative", zIndex: 10 }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "clamp(16px, 3vw, 40px) clamp(12px, 4vw, 5vw)",
            color: "white",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div
            style={{
              fontSize: "clamp(18px, 4vw, 24px)",
              fontWeight: "bold",
              minWidth: "120px",
            }}
          >
            {headerTitle}
          </div>

          {/* Action Buttons */}
          <div
            style={{
              display: "flex",
              gap: "8px",
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
            {headerActions.map((action, idx) => (
              <button
                key={idx}
                onClick={action.onClick}
                disabled={action.disabled || false}
                style={{
                  padding: "clamp(8px, 1.5vw, 12px) clamp(12px, 2.5vw, 24px)",
                  borderRadius: "20px",
                  border: action.style?.border || "none",
                  background: action.style?.background || "black",
                  color: action.style?.color || "white",
                  cursor: action.disabled ? "not-allowed" : "pointer",
                  fontSize: "clamp(13px, 2vw, 16px)",
                  whiteSpace: "nowrap",
                  opacity: action.disabled ? 0.6 : 1,
                  fontWeight: 600,
                  ...action.style,
                }}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content Area */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight,
            padding: "clamp(12px, 3vw, 20px)",
          }}
        >
          {/* Content Card */}
          <div
            style={{
              width: "100%",
              maxWidth,
              padding: "clamp(20px, 5vw, 40px)",
              borderRadius: "24px",
              background: "rgba(255,255,255,0.92)",
              backdropFilter: "blur(12px)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
              overflowX: "hidden",
              ...cardStyle,
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Utility function for responsive input/select styling
 */
export const responsiveInputStyle = {
  padding: "clamp(10px, 2vw, 12px)",
  borderRadius: "10px",
  border: "1px solid #ccc",
  fontSize: "clamp(13px, 1.8vw, 16px)",
  color: "#111",
  width: "100%",
  boxSizing: "border-box",
};

/**
 * Utility function for responsive button styling
 */
export const responsiveButtonStyle = (bgColor = "black", textColor = "white") => ({
  padding: "clamp(8px, 1.5vw, 12px) clamp(12px, 2.5vw, 18px)",
  borderRadius: "10px",
  border: "none",
  background: bgColor,
  color: textColor,
  cursor: "pointer",
  fontSize: "clamp(13px, 1.8vw, 15px)",
  whiteSpace: "nowrap",
  fontWeight: 600,
  width: "100%",
  boxSizing: "border-box",
});

/**
 * Utility for mobile-friendly grid layouts
 */
export const mobileGridStyle = (minColWidth = "150px") => ({
  display: "grid",
  gridTemplateColumns: `repeat(auto-fit, minmax(${minColWidth}, 1fr))`,
  gap: "12px",
  width: "100%",
});

/**
 * Utility for responsive heading
 */
export const responsiveHeadingStyle = {
  fontSize: "clamp(20px, 4vw, 28px)",
  fontWeight: "bold",
  marginBottom: "16px",
  textAlign: "center",
};

/**
 * Utility for responsive subtext
 */
export const responsiveSubtextStyle = {
  fontSize: "clamp(12px, 2vw, 14px)",
  color: "#666",
  marginBottom: "20px",
  textAlign: "center",
};
