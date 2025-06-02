module.exports = {
    presets: [
      [
        '@babel/preset-env',
        {
          targets: {
            node: 'current', // Match your Node.js version
          },
        },
      ],
    ],
  };