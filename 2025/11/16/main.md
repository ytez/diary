# ベクトルの一次変換 メモ (『技術者のための線形代数学』より)

## 1

次の写像 $\varphi$ を考える．※ただし $(a, b, c, d \in \mathbf{R})$ とする．

$$
\varphi\colon \mathbf{R}^2 \to \mathbf{R}^2
$$
$$
\mathbf{x} = \begin{pmatrix}
  x \\
  y
\end{pmatrix} \mapsto \varphi(\mathbf{x}) = x\begin{pmatrix}
  a \\
  c
\end{pmatrix} + y\begin{pmatrix}
  b \\
  d
\end{pmatrix}
$$

実数ベクトル $\mathbf{x} = (x, y)^{\mathrm{T}}$ を標準基底の線形結合で表すと次のようになる．

$$
\mathbf{x} = x\mathbf{e}_1 + y\mathbf{e}_2
$$

標準基底 $\mathbf{e}_1, \mathbf{e}_2$ の行き先は次のようになる．

$$
\varphi(\mathbf{e}_1) = \begin{pmatrix}
  a \\
  c
\end{pmatrix}
$$
$$
\varphi(\mathbf{e}_2) = \begin{pmatrix}
  b \\
  d
\end{pmatrix}
$$

したがって $\varphi(\mathbf{x})$ について次の関係が成り立つ．

###### (1-1)

$$
\varphi(\mathbf{x}) = x\varphi(\mathbf{e}_1) + y\varphi(\mathbf{e}_2)
$$ 

記号を下記のように整理すると，

$$
\mathbf{x'} = \varphi(\mathbf{x}) \\
\mathbf{e}_1' = \varphi(\mathbf{e}_1) \\
\mathbf{e}_2' = \varphi(\mathbf{e}_2)
$$

(1-1) は下記のように書き直すことができる．

$$
\mathbf{x'} = x\mathbf{e}_1' + y\mathbf{e}_2'
$$

## 2

基底ベクトル $\mathbf{e}_1', \mathbf{e}_2'$ を任意に決めると $\mathbf{R}^2$ の任意の要素 $\mathbf{x}$ をその線形結合で表すことができる．

$$
\mathbf{x} = a\mathbf{e}_1' + b\mathbf{e}_2'
$$

$\mathbf{x}$ に一次変換 $\varphi$ を適用すると次のようになる．

$$
\varphi(\mathbf{x}) = a\varphi(\mathbf{e}_1') + b\varphi(\mathbf{e}_2')
$$

これは次の手順で証明することができる．

(※いったんここまで 2025-11-16)