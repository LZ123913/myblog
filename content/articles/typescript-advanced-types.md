# TypeScript 高级类型实战

## 条件类型

```typescript
type IsString<T> = T extends string ? true : false

type A = IsString<'hello'> // true
type B = IsString<42>      // false
```

## 映射类型

```typescript
type Readonly<T> = {
  readonly [P in keyof T]: T[P]
}

type Partial<T> = {
  [P in keyof T]?: T[P]
}
```

## 模板字面量类型

```typescript
type EventName = `on${Capitalize<string>}`

type T1 = EventName // "onClick" | "onScroll" | ...
```

## infer 关键字

```typescript
type ReturnType<T> = T extends (...args: any[]) => infer R ? R : never

type PromiseType<T> = T extends Promise<infer U> ? U : T
```

## 实战：API 类型推导

```typescript
interface Article {
  id: number
  title: string
  content: string
}

type ArticleKeys = keyof Article // 'id' | 'title' | 'content'
type ArticleValues = Article[keyof Article] // number | string

function pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>
  keys.forEach(key => { result[key] = obj[key] })
  return result
}
```

## 总结

TypeScript 的高级类型系统非常强大，掌握条件类型、映射类型和 infer 可以构建出类型安全的工具函数。