# Material Images

Place one image file per material here. Any format works (jpg, png, webp).

To add a new material:
1. Drop the image into this folder, e.g. `leather.jpg`
2. Open `src/data/materials.js` and add one entry:

```js
{
  id:    'leather',
  label: 'Leather',
  image: 'materials/leather.jpg',  // path relative to public/
  color: '#8B6040',                // representative hex — used in log dots and monitor
  size:  100,
}
```

That's it. The material will appear in the drawer and be available for templates automatically.
