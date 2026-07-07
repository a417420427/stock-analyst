/// <reference types="@tarojs/taro" />

declare module '*.png'
declare module '*.jpg'
declare module '*.svg'
declare module '*.gif'

declare module '*.scss' {
  const content: Record<string, string>
  export default content
}
