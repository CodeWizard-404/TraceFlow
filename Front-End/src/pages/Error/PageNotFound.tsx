import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import "./PageNotFound.css";

const PageNotFound: React.FC = () => {
  const navigate = useNavigate();
  const [lines, setLines] = useState<JSX.Element[]>([]);

  // Generate animated digital lines for the background
  useEffect(() => {
    const generateLines = () => {
      const lineElements = Array.from({ length: 20 }, (_, i) => {
        const isVertical = Math.random() > 0.5;
        const size = Math.random() * 200 + 50;
        const pos = Math.random() * 100;
        const animationDelay = Math.random() * 3;
        return (
          <div
            key={i}
            className={`line ${isVertical ? "vertical" : "horizontal"}`}
            style={{
              [isVertical ? "height" : "width"]: `${size}px`,
              [isVertical ? "left" : "top"]: `${pos}%`,
              animationDelay: `${animationDelay}s`,
            }}
          />
        );
      });
      setLines(lineElements);
    };
    generateLines();
  }, []);

  const handleBack = () => {
    navigate(-1); // Go back to the previous page
  };

  return (
    <div className="not-found-container">
      {/* Digital Lines Background */}
      <div className="lines-layer">{lines}</div>

      {/* Main Content */}
      <div className="not-found-content">
        {/* 404 Text with Glitch Effect */}
        <h1 className="not-found-title">
          <span className="glitch" data-text="404">
            404
          </span>
          <span className="subtitle">Page Not Found</span>
        </h1>

        {/* Message */}
        <p className="not-found-message">
          Oops! It looks like this page doesn’t exist or has been moved.
        </p>

        {/* Back Button */}
        <button className="back-btn" onClick={handleBack}>
          <FaArrowLeft /> Return
        </button>
      </div>

      {/* Grid Overlay */}
      <div className="grid-overlay" />
    </div>
  );
};

export default PageNotFound;