# Layouts

Kumquat v0.2 supports nested `layout.html` files.

```txt
app/layout.html
app/routes/dashboard/layout.html
app/routes/dashboard/settings/layout.html
```

For `/dashboard/settings`, Kumquat renders:

```txt
page.html -> dashboard/settings/layout.html -> dashboard/layout.html -> app/layout.html
```

Use `{{ slot }}` for child HTML. `slot` is not escaped again. Other variables still use normal HTML escaping.
